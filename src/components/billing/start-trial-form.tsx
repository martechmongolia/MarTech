"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startTrialAction, type StartTrialState } from "@/modules/subscriptions/actions";

type Props = { organizationId: string };
const initial: StartTrialState = {};

export function StartTrialForm({ organizationId }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(startTrialAction, initial);

  useEffect(() => {
    if (state.ok) router.push("/dashboard");
  }, [state.ok, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%",
          padding: "0.875rem 2rem",
          background: pending ? "#4b5563" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "white",
          border: "none",
          borderRadius: "0.75rem",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: pending ? "not-allowed" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {pending ? "Эхлүүлж байна..." : "🚀 Үнэгүй 14 хоног туршиж үзэх"}
      </button>
      {state.error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", margin: "0.5rem 0 0", textAlign: "center" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
