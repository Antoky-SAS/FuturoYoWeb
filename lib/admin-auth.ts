import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "fy-admin";

function expectedToken() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update("futuroyo-admin-v1").digest("hex");
}

export function tokenFor(password: string) {
  const expected = expectedToken();
  if (!expected) return null;
  const given = createHmac("sha256", password).update("futuroyo-admin-v1").digest("hex");
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected)) ? expected : null;
}

export async function isAdmin() {
  const expected = expectedToken();
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!expected || !got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
