// Real auth: Clerk handles email + OTP login. We map the Clerk user's email to
// a Person row in the PKG. Persona/role come from the Person record, not from
// Clerk, so org structure stays the source of truth.
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

export async function currentPerson() {
  const user = await currentUser();
  if (!user) return null;
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  return db.person.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function currentUserEmail() {
  const user = await currentUser();
  return (
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null
  );
}

export async function isSignedIn() {
  const { userId } = await auth();
  return Boolean(userId);
}

export type Persona = NonNullable<Awaited<ReturnType<typeof currentPerson>>>;

export function roleLabel(role: string) {
  switch (role) {
    case "employee":
      return "Employee";
    case "manager":
      return "Manager";
    case "hrbp":
      return "HR Business Partner";
    case "hr_admin":
      return "HR Admin";
    default:
      return role;
  }
}
