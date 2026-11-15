import Link from "next/link";
import { after } from "next/server";
import { requireCircle } from "@/lib/session";
import { runTickIfDue } from "@/lib/tick";
import { Kite } from "@/components/ui";
import { NavLinks } from "@/components/Nav";
import { leaveCircle } from "../actions";

export const dynamic = "force-dynamic";

export default async function CircleLayout({ children }: { children: React.ReactNode }) {
  const { profile, member } = await requireCircle();
  // After the page is sent: keep reminders flowing even if the scheduled timer is late.
  after(async () => {
    try {
      await runTickIfDue(profile.id);
    } catch (err) {
      console.error("[tick] page-visit check failed", err);
    }
  });
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/p" className="flex items-center gap-2">
            <Kite className="h-8 w-8" />
            <span className="font-display text-2xl font-semibold">Dor</span>
          </Link>
          <div className="text-sm leading-tight">
            <div className="font-bold">{profile.elder_name}’s circle</div>
            <div className="text-muted">
              {profile.code} · you’re {member.name} ({member.role})
            </div>
          </div>
          <form action={leaveCircle} className="ml-auto">
            <button className="text-sm font-bold text-muted underline-offset-4 hover:underline">Sign out</button>
          </form>
        </div>
        <NavLinks />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
