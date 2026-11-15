import Link from "next/link";
import { Kite, primary, type FlashParams } from "@/components/ui";

export default async function Done({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const { ok, error } = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <Kite className="mx-auto h-14 w-14" />
      <h1 className={`font-display mt-4 text-3xl ${error ? "text-alarm" : ""}`}>{error ?? ok ?? "Done."}</h1>
      <Link href="/p" className={`${primary} mt-8`}>Open Dor</Link>
    </main>
  );
}
