"use client";

import { useTransition } from "react";
import { refreshDashboard } from "./actions";

export default function RefreshButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await refreshDashboard();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-sm text-muted hover:text-ink transition-colors disabled:opacity-50"
      title="Refresh"
    >
      <span className={pending ? "inline-block animate-spin" : "inline-block"}>↻</span>
      {" "}{pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}