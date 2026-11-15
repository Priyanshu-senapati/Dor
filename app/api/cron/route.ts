import { timingSafeEqual } from "node:crypto";
import { runTick } from "@/lib/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called every 5 minutes by the GitHub Actions workflow with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await runTick(new Date()));
}
