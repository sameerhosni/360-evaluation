import Link from "next/link";
import { redirect } from "next/navigation";
import { clearPersonaCookie, type Persona, roleLabel } from "@/lib/session";
import { Avatar } from "@/components/ui";
import { TwinChatDrawer } from "@/components/twin-chat-drawer";
import { LocaleToggle } from "@/components/locale-toggle";
import { currentLocale, t, tNode } from "@/lib/i18n";

async function signOut() {
  "use server";
  await clearPersonaCookie();
  redirect("/");
}

export async function AppShell({
  me,
  children,
}: {
  me: Persona;
  children: React.ReactNode;
}) {
  const locale = await currentLocale();

  // Translate role label too (small bilingual gesture)
  const localizedRole =
    locale === "ar"
      ? me.role === "employee" ? t(locale, "common.employee")
      : me.role === "manager" ? t(locale, "common.manager")
      : me.role === "hrbp"    ? t(locale, "common.hrbp")
      : roleLabel(me.role)
      : roleLabel(me.role);

  const nav: Array<{ href: string; label: string; show: boolean }> = [
    { href: "/dashboard",            label: t(locale, "nav.dashboard"),         show: me.role === "employee" },
    { href: "/inbox",                label: t(locale, "nav.inbox"),             show: me.role === "employee" },
    { href: "/peer-feedback",        label: t(locale, "nav.peerFeedback"),      show: me.role === "employee" },
    { href: "/self-appraisal",       label: t(locale, "nav.selfAppraisal"),     show: me.role === "employee" },
    { href: "/twin",                 label: t(locale, "nav.twin"),              show: me.role === "employee" },
    { href: "/cockpit",              label: t(locale, "nav.cockpit"),           show: me.role === "manager" },
    { href: "/cockpit/achievements", label: t(locale, "nav.achievementsQueue"), show: me.role === "manager" },
    { href: "/sentinel",             label: t(locale, "nav.sentinel"),          show: me.role === "hrbp" },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      {/* Top bar */}
      <header className="border-b border-soft bg-surface-100/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/" className="font-display text-xl text-ink-900 hover:text-gold-700 transition flex-shrink-0">
              Pulse<span className="text-gold-600 italic">360</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 min-w-0 overflow-x-auto">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-2 rounded-lg text-[13px] text-ink-700 hover:text-ink-900 hover:bg-ink-50 transition font-medium whitespace-nowrap ${locale === "ar" ? "font-ar" : ""}`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <LocaleToggle
              current={locale}
              labels={{
                en: t(locale, "locale.english"),
                ar: t(locale, "locale.arabic"),
                switchTo: t(locale, "locale.switchTo"),
              }}
            />
            <div className="text-end hidden sm:block">
              <div className={`text-[13px] text-ink-900 font-medium leading-tight ${locale === "ar" ? "font-ar" : ""}`}>
                {me.preferredName ?? me.fullName.split(" ")[0]}
              </div>
              <div className={`text-[11px] text-ink-400 ${locale === "ar" ? "font-ar" : ""}`}>{localizedRole}</div>
            </div>
            <Avatar name={me.fullName} role={me.role} size={36} />
            <form action={signOut}>
              <button
                type="submit"
                className={`btn-ghost text-[12px] px-3 py-2 ${locale === "ar" ? "font-ar" : ""}`}
                title={t(locale, "common.switch")}
              >
                {t(locale, "common.switch")}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-[1400px] mx-auto px-6 lg:px-10 py-10 w-full">
        {children}
      </main>

      <footer className="border-t border-soft py-4 mt-12">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 flex items-center justify-between text-[11px] text-ink-400">
          <span>Pulse360 · WorkQuest pilot</span>
          <span className="font-mono">T2 · H1 2026 · CALIBRATION</span>
        </div>
      </footer>

      {/* Twin chat — private to the employee. Manager and HRBP have other
          conversational surfaces. */}
      {me.role === "employee" && (
        <TwinChatDrawer
          personFirstName={me.preferredName ?? me.fullName.split(" ")[0]}
          labels={{
            launcher: t(locale, "twin.chatLauncher"),
            launcherEyebrow: t(locale, "twin.chatLauncherEyebrow"),
            title: t(locale, "twin.chatTitle"),
            privacy: t(locale, "twin.chatPrivacy"),
            greeting: t(locale, "twin.chatGreeting"),
            tryAsking: t(locale, "twin.chatTryAsking"),
            suggestions: (tNode(locale, "twin.chatSuggestions") as string[]) ?? undefined,
            placeholder: t(locale, "twin.chatPlaceholder"),
            clearConversation: t(locale, "twin.chatClearConversation"),
            errorTitle: t(locale, "twin.chatErrorTitle"),
          }}
        />
      )}
    </div>
  );
}
