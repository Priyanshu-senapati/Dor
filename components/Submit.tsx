"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** A form's submit button that shows it is working and can't be tapped twice. */
export function Submit({ className, children, pending = "Saving…" }: { className: string; children: ReactNode; pending?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className={`${className} disabled:cursor-wait`}>
      {busy ? pending : children}
    </button>
  );
}
