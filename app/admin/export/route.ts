import { isAdmin } from "@/lib/admin-auth";
import { AREAS, ensureSchema, sql, type Signup } from "@/lib/db";

const cell = (v: unknown) => {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const areaParam = url.searchParams.get("area") ?? "";
  const area = (AREAS as readonly string[]).includes(areaParam) ? areaParam : "";
  const entParam = url.searchParams.get("ent") ?? "";
  const ent = entParam === "Sí" || entParam === "No" ? entParam : "";

  await ensureSchema();
  const rows = (await sql()`
    SELECT id, name, email, area, ent, created_at FROM waitlist
    WHERE (${area} = '' OR area = ${area}) AND (${ent} = '' OR ent = ${ent})
    ORDER BY id`) as Signup[];

  const csv = [
    ["puesto", "nombre", "email", "area", "emprende", "fecha"].join(","),
    ...rows.map((r) =>
      [r.id, r.name, r.email, r.area, r.ent, new Date(r.created_at).toISOString()].map(cell).join(","),
    ),
  ].join("\n");

  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="futuroyo-waitlist-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
