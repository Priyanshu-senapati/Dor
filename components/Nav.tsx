"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/p", "Today"],
  ["/p/meds", "Medicines"],
  ["/p/appointments", "Appointments"],
  ["/p/trace", "Trace"],
  ["/p/circle", "Circle"],
  ["/p/elder", "Elder mode"],
] as const;

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Sections" className="mx-auto max-w-6xl overflow-x-auto px-4">
      <ul className="flex gap-1 pb-2">
        {LINKS.map(([href, text]) => {
          const active = path === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-bold ${
                  active ? "bg-ink text-white" : "text-ink hover:bg-ink/5"
                }`}
              >
                {text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
