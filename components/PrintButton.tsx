"use client";

import { primary } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${primary} no-print`}>
      Print / save PDF
    </button>
  );
}
