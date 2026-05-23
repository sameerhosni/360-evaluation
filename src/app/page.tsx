import { redirect } from "next/navigation";
import { currentPerson, currentUserEmail } from "@/lib/session";

// Middleware ensures the user is signed in by the time they hit `/`.
// We look up their Person record by email and send them to the right home.
export default async function Landing() {
  const me = await currentPerson();
  if (!me) {
    const email = await currentUserEmail();
    redirect(`/no-access${email ? `?email=${encodeURIComponent(email)}` : ""}`);
  }
  if (me.role === "manager") redirect("/cockpit");
  if (me.role === "hrbp" || me.role === "hr_admin") redirect("/sentinel");
  redirect("/dashboard");
}
