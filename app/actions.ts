"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { AREAS, ENT_OPTS, ensureSchema, sql } from "@/lib/db";

export type JoinInput = { name: string; email: string; area: string; ent: string; website?: string };
export type JoinResult = { ok: true; name: string; pos: number } | { ok: false; error: string };

const MAX_PER_IP_PER_HOUR = 5;

export async function joinWaitlist(input: JoinInput): Promise<JoinResult> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 160);
  const area = (AREAS as readonly string[]).includes(input.area) ? input.area : AREAS[0];
  const ent = (ENT_OPTS as readonly string[]).includes(input.ent) ? input.ent : ENT_OPTS[0];

  if (!name) return { ok: false, error: "Escribe tu nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Revisa tu correo electrónico." };
  // Honeypot: bots fill the hidden field; pretend success without storing.
  if (input.website) return { ok: true, name, pos: 0 };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const ipHash = ip ? createHash("sha256").update(ip + (process.env.IP_SALT ?? "fy")).digest("hex").slice(0, 32) : null;

  try {
    await ensureSchema();
    const db = sql();

    const existing = (await db`SELECT id, name FROM waitlist WHERE email = ${email}`) as { id: number; name: string }[];
    if (existing.length) return { ok: true, name: existing[0].name, pos: await positionOf(existing[0].id) };

    if (ipHash) {
      const [{ n }] = (await db`
        SELECT count(*)::int AS n FROM waitlist
        WHERE ip_hash = ${ipHash} AND created_at > now() - interval '1 hour'`) as { n: number }[];
      if (n >= MAX_PER_IP_PER_HOUR) return { ok: false, error: "Demasiados registros desde esta red. Intenta más tarde." };
    }

    const [row] = (await db`
      INSERT INTO waitlist (name, email, area, ent, ip_hash)
      VALUES (${name}, ${email}, ${area}, ${ent}, ${ipHash})
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, name`) as { id: number; name: string }[];
    return { ok: true, name: row.name, pos: await positionOf(row.id) };
  } catch (e) {
    console.error("joinWaitlist failed", e);
    return { ok: false, error: "No pudimos guardar tu registro. Intenta de nuevo." };
  }
}

async function positionOf(id: number) {
  const [{ n }] = (await sql()`SELECT count(*)::int AS n FROM waitlist WHERE id <= ${id}`) as { n: number }[];
  return n;
}
