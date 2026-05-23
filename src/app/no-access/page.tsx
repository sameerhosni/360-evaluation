import { SignOutButton } from "@clerk/nextjs";
import { Card } from "@/components/ui";
import { currentLocale, t } from "@/lib/i18n";

export default async function NoAccess({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const locale = await currentLocale();
  const isAr = locale === "ar";

  const title = isAr ? "لا توجد صلاحية" : "No access";
  const body = isAr
    ? "بريدك الإلكتروني غير مرتبط بأي موظف في هذه المنظمة. يرجى تسجيل الدخول بحساب الشركة، أو التواصل مع فريق الموارد البشرية لإضافتك."
    : "Your email isn't linked to anyone in this organization. Sign in with your company email, or ask HR to add you to the directory.";
  const signedInAs = isAr ? "تسجيل الدخول كـ" : "Signed in as";
  const signOut = isAr ? "تسجيل الخروج" : "Sign out";

  return (
    <main className={`min-h-screen flex items-center justify-center bg-surface-50 p-6 ${isAr ? "font-ar" : ""}`}>
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-warn-50 mx-auto mb-5 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#BF8120" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="font-display text-2xl text-ink-900 mb-2">{title}</h1>
        <p className="text-[14px] text-ink-600 leading-relaxed mb-6">{body}</p>
        {email && (
          <div className="text-[11px] text-ink-400 mb-4">
            {signedInAs}: <span className="font-mono text-ink-700">{email}</span>
          </div>
        )}
        <SignOutButton redirectUrl="/sign-in">
          <button className="btn-primary w-full">{signOut}</button>
        </SignOutButton>
      </Card>
    </main>
  );
}
