import { Suspense } from "react";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { AREAS, ensureSchema, sql, type Signup } from "@/lib/db";
import { logout } from "./actions";
import LoginForm from "./login-form";
import "./admin.css";

export const metadata: Metadata = { title: "FuturoYo · Admin", robots: { index: false, follow: false } };

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <main className="adm">
      <Suspense fallback={<p className="adm-dim">Cargando…</p>}>
        <AdminContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminContent({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  if (!(await isAdmin())) return <LoginForm />;

  const sp = await searchParams;
  const area = typeof sp.area === "string" && (AREAS as readonly string[]).includes(sp.area) ? sp.area : "";
  const ent = sp.ent === "Sí" || sp.ent === "No" ? sp.ent : "";

  await ensureSchema();
  const db = sql();
  const rows = (await db`
    SELECT id, name, email, area, ent, created_at FROM waitlist
    WHERE (${area} = '' OR area = ${area}) AND (${ent} = '' OR ent = ${ent})
    ORDER BY id DESC LIMIT 1000`) as Signup[];
  const [stats] = (await db`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS today,
           count(*) FILTER (WHERE ent = 'Sí')::int AS ent
    FROM waitlist`) as { total: number; today: number; ent: number }[];
  const byArea = (await db`SELECT area, count(*)::int AS n FROM waitlist GROUP BY area ORDER BY n DESC`) as {
    area: string;
    n: number;
  }[];

  const qs = new URLSearchParams({ ...(area && { area }), ...(ent && { ent }) }).toString();
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

  return (
    <>
      <header className="adm-head">
        <h1>Lista de espera</h1>
        <div className="adm-actions">
          <a className="adm-btn" href={`/admin/export${qs ? "?" + qs : ""}`}>Exportar CSV</a>
          <form action={logout}>
            <button className="adm-btn ghost" type="submit">Salir</button>
          </form>
        </div>
      </header>

      <section className="adm-stats">
        <div><b>{stats.total}</b><span>Total</span></div>
        <div><b>{stats.today}</b><span>Últimas 24 h</span></div>
        <div><b>{stats.ent}</b><span>Emprenden</span></div>
        {byArea.map((a) => (
          <div key={a.area}><b>{a.n}</b><span>{a.area}</span></div>
        ))}
      </section>

      <form className="adm-filters" method="get">
        <select name="area" defaultValue={area}>
          <option value="">Todas las áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select name="ent" defaultValue={ent}>
          <option value="">Emprende: todos</option>
          <option value="Sí">Emprende: Sí</option>
          <option value="No">Emprende: No</option>
        </select>
        <button className="adm-btn" type="submit">Filtrar</button>
        <span className="adm-dim">{rows.length} resultados</span>
      </form>

      <div className="adm-table">
        <table>
          <thead>
            <tr><th>#</th><th>Nombre</th><th>Email</th><th>Área</th><th>Emprende</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                <td>{r.area}</td>
                <td>{r.ent}</td>
                <td>{fmt.format(new Date(r.created_at))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="adm-dim">Sin registros todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
