"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LocaleToggle({
  current,
  labels,
}: {
  current: "en" | "ar";
  labels: { en: string; ar: string; switchTo: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const flip = (target: "en" | "ar") => {
    if (target === current) return;
    start(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: target }),
      });
      router.refresh();
    });
  };

  return (
    <div
      className="inline-flex items-center bg-ink-50 border border-soft rounded-full p-0.5"
      title={labels.switchTo}
    >
      <button
        onClick={() => flip("en")}
        disabled={pending}
        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
          current === "en"
            ? "bg-white text-ink-900 shadow-sm"
            : "text-ink-500 hover:text-ink-900"
        }`}
        aria-pressed={current === "en"}
      >
        {labels.en}
      </button>
      <button
        onClick={() => flip("ar")}
        disabled={pending}
        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
          current === "ar"
            ? "bg-white text-ink-900 shadow-sm font-ar"
            : "text-ink-500 hover:text-ink-900 font-ar"
        }`}
        aria-pressed={current === "ar"}
      >
        {labels.ar}
      </button>
    </div>
  );
}
