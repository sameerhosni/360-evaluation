import { SignIn } from "@clerk/nextjs";
import { LocaleToggle } from "@/components/locale-toggle";
import { currentLocale, t } from "@/lib/i18n";

export default async function SignInPage() {
  const locale = await currentLocale();
  const isAr = locale === "ar";

  return (
    <main className="min-h-screen flex flex-col bg-surface-50">
      <div className="border-b border-soft bg-surface-100">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-display text-xl text-ink-900">
              Pulse<span className="text-gold-600 italic">360</span>
            </div>
            <div className={`text-[11px] text-ink-400 ${isAr ? "font-ar" : "font-mono"}`}>
              · WorkQuest · T2
            </div>
          </div>
          <LocaleToggle
            current={locale}
            labels={{
              en: t(locale, "locale.english"),
              ar: t(locale, "locale.arabic"),
              switchTo: t(locale, "locale.switchTo"),
            }}
          />
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_auto] gap-12 max-w-[1400px] mx-auto px-6 lg:px-10 py-16 w-full">
        <div className={`max-w-xl self-center ${isAr ? "font-ar" : ""}`}>
          <div className="eyebrow mb-4">{t(locale, "landing.eyebrow")}</div>
          <h1 className="font-display text-5xl lg:text-6xl text-ink-900 leading-[1.05] mb-5">
            {t(locale, "landing.heroLine1")}
            <br />
            <span className="italic text-gold-700">{t(locale, "landing.heroLine2")}</span>
          </h1>
          <p className="text-ink-500 text-[17px] leading-relaxed">
            {t(locale, "landing.subtitle")}
          </p>
          <div className="mt-8 text-[12px] text-ink-400 max-w-md">
            {t(locale, "landing.pilotNote")}
          </div>
        </div>

        <div className="self-center justify-self-center lg:justify-self-end">
          <SignIn
            appearance={{
              elements: {
                rootBox: "shadow-none",
                card: "shadow-lg border border-soft bg-white",
              },
            }}
            forceRedirectUrl="/"
            signUpForceRedirectUrl="/"
          />
        </div>
      </div>

      <footer className="border-t border-soft py-4">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 flex items-center justify-between text-[11px] text-ink-400">
          <span>Pulse360 · WorkQuest pilot · v1.0</span>
          <span className="font-mono">T2 · H1 2026</span>
        </div>
      </footer>
    </main>
  );
}
