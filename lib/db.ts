import "server-only";
import { neon } from "@neondatabase/serverless";

export const AREAS = ["Profesional", "Finanzas", "Salud", "Relaciones", "Personal", "Estilo de vida"] as const;
export const ENT_OPTS = ["Sí", "No"] as const;

export type Signup = {
  id: number;
  name: string;
  email: string;
  area: string;
  ent: string;
  created_at: string;
};

let sqlClient: ReturnType<typeof neon> | null = null;
let ready: Promise<unknown> | null = null;

export function sql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    sqlClient = neon(url);
  }
  return sqlClient;
}

// Creates the table on first use per instance; cheap no-op afterwards.
export function ensureSchema() {
  ready ??= (async () => {
    const db = sql();
    await db`
      CREATE TABLE IF NOT EXISTS waitlist (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL UNIQUE,
        area       TEXT NOT NULL,
        ent        TEXT NOT NULL,
        ip_hash    TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await db`CREATE INDEX IF NOT EXISTS waitlist_ip_recent ON waitlist (ip_hash, created_at)`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
