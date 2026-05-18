import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentPerson, setPersonaCookie, roleLabel } from "@/lib/session";
import { Avatar, Card } from "@/components/ui";
import { LocaleToggle } from "@/components/locale-toggle";
import { currentLocale, t } from "@/lib/i18n";

async function pickPersona(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  if (!email) return;
  await setPersonaCookie(email);
  redirect("/dashboard");
}

const FEATURED_EMAILS = ["lina.alahmadi@t2.sa", "khalid.alrashid@t2.sa", "maha.alotaibi@t2.sa"];

const FEATURED_COPY_EN: Record<string, { surface: string; helper: string }> = {
  "lina.alahmadi@t2.sa":   { surface: "Pulse Dashboard",      helper: "The employee experience — daily score, achievement inbox, Twin console." },
  "khalid.alrashid@t2.sa": { surface: "Calibration Cockpit",  helper: "The manager experience — 11 direct reports, pre-computed scores, calibration sheet." },
  "maha.alotaibi@t2.sa":   { surface: "Bias Sentinel",        helper: "The HR oversight surface — flagged patterns with effect size and recommended actions." },
};

const FEATURED_COPY_AR: Record<string, { surface: string; helper: string }> = {
  "lina.alahmadi@t2.sa":   { surface: "لوحة النبض",            helper: "تجربة الموظف — درجة يومية، صندوق الإنجازات، وحدة التوأم الذكي." },
  "khalid.alrashid@t2.sa": { surface: "غرفة المعايرة",         helper: "تجربة المدير — ١١ موظفًا مباشرًا، درجات محسوبة مسبقًا، ورقة معايرة." },
  "maha.alotaibi@t2.sa":   { surface: "حارس الإنصاف",          helper: "سطح إشراف الموارد البشرية — أنماط موسومة بحجم الأثر والإجراء المقترح." },
};

const LOCALIZED_ROLE_LABELS = (locale: "en" | "ar") => (role: string) =>
  locale === "ar"
    ? role === "employee" ? t(locale, "common.employee")
    : role === "manager" ? t(locale, "common.manager")
    : role === "hrbp"    ? t(locale, "common.hrbp")
    : roleLabel(role)
    : roleLabel(role);

export default async function Landing() {
  const me = await currentPerson();
  if (me) {
    if (me.role === "manager") redirect("/cockpit");
    if (me.role === "hrbp") redirect("/sentinel");
    redirect("/dashboard");
  }

  const locale = await currentLocale();
  const isAr = locale === "ar";

  const personas = await db.person.findMany({
    where: { role: { in: ["employee", "manager", "hrbp"] } },
    orderBy: { fullName: "asc" },
  });
  const featured = personas.filter((p) => FEATURED_EMAILS.includes(p.email));
  const others = personas.filter((p) => !featured.find((f) => f.id === p.id));
  const COPY = isAr ? FEATURED_COPY_AR : FEATURED_COPY_EN;
  const localizedRole = LOCALIZED_ROLE_LABELS(locale);

  return (
    <main className="min-h-screen flex flex-col">
      <div className="border-b border-soft bg-surface-100">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-display text-xl text-ink-900">
              Pulse<span className="text-gold-600 italic">360</span>
            </div>
            <div className={`text-[11px] text-ink-400 ${isAr ? "font-ar" : "font-mono"}`}>
              · WorkQuest pilot · T2
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

      <div className="flex-1 max-w-[1400px] mx-auto px-6 lg:px-10 py-16 w-full">
        {/* Hero */}
        <div className={`max-w-3xl mb-14 ${isAr ? "font-ar" : ""}`}>
          <div className="eyebrow mb-4">{t(locale, "landing.eyebrow")}</div>
          <h1 className="font-display text-5xl lg:text-6xl text-ink-900 leading-[1.05] mb-5">
            {t(locale, "landing.heroLine1")}
            <br />
            <span className="italic text-gold-700">{t(locale, "landing.heroLine2")}</span>
          </h1>
          <p className="text-ink-500 text-[17px] leading-relaxed max-w-2xl">
            {t(locale, "landing.subtitle")}
          </p>
        </div>

        {/* Featured personas */}
        <div className="mb-12">
          <h2 className={`text-[13px] font-semibold text-ink-700 uppercase tracking-wider mb-4 ${isAr ? "font-ar" : ""}`}>
            {t(locale, "landing.featured")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featured.map((p) => {
              const copy = COPY[p.email];
              return (
                <form action={pickPersona} key={p.id} className="contents">
                  <input type="hidden" name="email" value={p.email} />
                  <button
                    type="submit"
                    className={`card card-hover p-6 text-left transition ${isAr ? "font-ar" : ""}`}
                  >
                    <div className="flex items-start justify-between mb-5">
                      <Avatar name={p.fullName} role={p.role} size={56} />
                      <span className="text-[11px] text-ink-400 uppercase tracking-wider">
                        {localizedRole(p.role)}
                      </span>
                    </div>
                    <div className="font-display text-2xl text-ink-900 mb-1">
                      {p.preferredName ?? p.fullName.split(" ")[0]}
                    </div>
                    <div className="text-[13px] text-ink-500 mb-4">{p.jobTitle}</div>
                    <div className="border-t border-soft pt-4">
                      <div className="text-[11px] text-gold-700 font-semibold uppercase tracking-wider mb-1">
                        {copy?.surface}
                      </div>
                      <div className="text-[13px] text-ink-600 leading-relaxed">
                        {copy?.helper}
                      </div>
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        </div>

        {/* Other personas */}
        {others.length > 0 && (
          <Card>
            <div className={`text-[13px] font-semibold text-ink-700 uppercase tracking-wider mb-4 ${isAr ? "font-ar" : ""}`}>
              {t(locale, "landing.others")}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {others.map((p) => (
                <form action={pickPersona} key={p.id}>
                  <input type="hidden" name="email" value={p.email} />
                  <button
                    type="submit"
                    className="w-full text-start px-3 py-2.5 rounded-lg border border-soft hover:bg-ink-50 transition flex items-center gap-3"
                  >
                    <Avatar name={p.fullName} role={p.role} size={32} />
                    <div className="min-w-0">
                      <div className={`text-[12px] text-ink-900 font-medium truncate ${isAr ? "font-ar" : ""}`}>
                        {p.fullName}
                      </div>
                      <div className="text-[10px] text-ink-400 truncate">{p.jobTitle}</div>
                    </div>
                  </button>
                </form>
              ))}
            </div>
          </Card>
        )}

        <div className={`mt-12 text-[12px] text-ink-400 max-w-2xl ${isAr ? "font-ar" : ""}`}>
          {t(locale, "landing.pilotNote")}
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
