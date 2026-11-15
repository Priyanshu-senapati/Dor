// Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) await sql.query(statement);
console.log(`Applied ${statements.length} statements.`);
