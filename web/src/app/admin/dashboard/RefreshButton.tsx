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
      className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
      title="Refresh"
    >
      <span className={pending ? "inline-block animate-spin" : "inline-block"}>↻</span>
      {" "}{pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
