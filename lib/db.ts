import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

/** Parameterised SQL (tagged template) against Neon; rows come back as plain objects. */
export function sql<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  if (!client) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client(strings, ...values) as unknown as Promise<T[]>;
}
