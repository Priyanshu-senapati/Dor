import type { ReactNode } from "react";

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:opacity-50";
export const primary = `${btn} bg-kite-deep text-white hover:bg-kite-ink`;
export const secondary = `${btn} border-2 border-ink/80 bg-white text-ink hover:bg-ink hover:text-white`;
export const good = `${btn} bg-leaf text-white hover:bg-leaf-ink`;
export const quiet = `${btn} px-3 py-2 text-sky hover:bg-sky/10`;
export const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30";
export const label = "mb-1 block text-sm font-bold text-muted";

export function Kite({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M32 3 L53 25 L32 45 L11 25 Z" fill="#e8762c" />
      <path d="M32 3 L53 25 L32 25 Z" fill="#f4a259" />
      <path d="M11 25 L32 45 L32 25 Z" fill="#b4501a" />
      <path d="M32 3V45M11 25H53" stroke="#1f2a44" strokeWidth="1.4" opacity=".45" />
      <path d="M32 45 C26 51 39 54 32 61" fill="none" stroke="#1f2a44" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M29 51 l-4 -2 M35 55 l4 -1" stroke="#2f6f8f" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-5 rounded-xl border px-4 py-3 font-bold ${
        error ? "border-alarm/30 bg-alarm/5 text-alarm" : "border-leaf/30 bg-leaf/5 text-leaf"
      }`}
    >
      {error ?? ok}
    </p>
  );
}

export function Card({
  title,
  eyebrow,
  children,
  className = "",
  id,
}: {
  title?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-2xl border border-line bg-white p-5 shadow-[0_1px_0_#e8dfd0] ${className}`}>
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.16em] text-kite-deep">{eyebrow}</p>}
      {title && <h2 className="font-display mb-3 mt-1 text-2xl">{title}</h2>}
      {children}
    </section>
  );
}

const tones = {
  ok: "bg-leaf/10 text-leaf",
  warn: "bg-warn/10 text-warn",
  alarm: "bg-alarm/10 text-alarm",
  info: "bg-sky/10 text-sky",
  plain: "bg-ink/5 text-ink",
} as const;

export function Pill({ tone = "plain", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold ${tones[tone]}`}>{children}</span>;
}

export interface FlashParams {
  ok?: string;
  error?: string;
}
