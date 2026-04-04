'use client';

interface Props {
  orgId: string;
}

/**
 * Facebook AI Settings page — client shell.
 * Full UI implementation is a separate task (frontend).
 */
export function FacebookSettingsClient({ orgId }: Props) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Facebook Comment AI Settings</h1>
      <p className="text-muted-foreground">
        Configure auto-reply settings for your connected Facebook pages.
      </p>
      <p className="text-xs text-muted-foreground mt-2">Org: {orgId}</p>
    </div>
  );
}
