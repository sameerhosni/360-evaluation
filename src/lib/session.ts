// Mock session — pilot does not need real auth. Production swaps this for OIDC/SAML
// (PRD §8.3). The session is a single signed cookie holding the active persona's email.
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "pulse360_persona";

export async function currentPerson() {
  const jar = await cookies();
  const email = jar.get(COOKIE_NAME)?.value;
  if (!email) return null;
  return db.person.findUnique({ where: { email } });
}

export async function setPersonaCookie(email: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 30 days
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearPersonaCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export type Persona = NonNullable<Awaited<ReturnType<typeof currentPerson>>>;

export function roleLabel(role: string) {
  switch (role) {
    case "employee": return "Employee";
    case "manager": return "Manager";
    case "hrbp": return "HR Business Partner";
    case "hr_admin": return "HR Admin";
    default: return role;
  }
}
