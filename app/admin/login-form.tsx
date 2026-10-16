"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="adm-login">
      <h1>FuturoYo · Admin</h1>
      <input type="password" name="password" placeholder="Contraseña" aria-label="Contraseña" autoFocus required />
      {error && <p className="adm-err">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
