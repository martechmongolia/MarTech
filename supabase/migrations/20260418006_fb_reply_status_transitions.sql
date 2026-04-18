-- Facebook Comment AI — Defense-in-depth state machine on fb_replies
-- Migration: 20260418006_fb_reply_status_transitions.sql
--
-- Application-side compare-and-swap already prevents invalid transitions in
-- data.ts (approveReply/rejectReply/markReplyPosted). This trigger is a belt
-- for the suspenders: if a bug or direct SQL edit tries to push a reply into
-- an impossible state (e.g. rejected → posted), Postgres blocks it.
--
-- Allowed transitions:
--   draft       → approved | rejected
--   approved    → posted   | edited_posted
--   posted      → (terminal, cannot change)
--   rejected    → (terminal)
--   edited_posted → (terminal)

create or replace function public.validate_fb_reply_status_transition()
returns trigger
language plpgsql
as $$
begin
  -- Only care about status changes
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'draft' then
    if new.status not in ('approved', 'rejected') then
      raise exception 'fb_replies: invalid transition % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  elsif old.status = 'approved' then
    if new.status not in ('posted', 'edited_posted', 'rejected') then
      raise exception 'fb_replies: invalid transition % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  elsif old.status in ('posted', 'rejected', 'edited_posted') then
    raise exception 'fb_replies: % is terminal, cannot change to %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_fb_reply_status_transitions on public.fb_replies;
create trigger enforce_fb_reply_status_transitions
  before update of status on public.fb_replies
  for each row
  execute function public.validate_fb_reply_status_transition();

comment on function public.validate_fb_reply_status_transition() is
  'Blocks invalid fb_replies.status transitions (e.g. posted→draft). Matches the app-level state machine in src/modules/facebook-ai/data.ts.';
