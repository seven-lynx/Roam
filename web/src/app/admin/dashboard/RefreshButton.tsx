"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    setSpinning(true);
    router.refresh();
    // Reset spinner after a brief delay — the refresh is near-instant
    setTimeout(() => setSpinning(false), 800);
  }

  return (
    <button
      onClick={handleClick}
      className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      title="Refresh"
    >
      <span className={spinning ? "inline-block animate-spin" : "inline-block"}>↻</span>
      {" "}Refresh
    </button>
  );
}
