import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <SignUp forceRedirectUrl="/" signInForceRedirectUrl="/" />
    </main>
  );
}
