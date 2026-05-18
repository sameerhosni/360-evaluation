import { NextRequest, NextResponse } from "next/server";
import { setLocaleCookie, type Locale } from "@/lib/i18n";

export async function POST(req: NextRequest) {
  let body: { locale?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const locale: Locale = body.locale === "ar" ? "ar" : "en";
  await setLocaleCookie(locale);
  return NextResponse.json({ ok: true, locale });
}
