import type { Metadata } from "next";
import { Fraunces, Manrope, Cairo, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { currentLocale, isRtl } from "@/lib/i18n";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});
const jbm = JetBrains_Mono({
  variable: "--font-jbm",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Pulse360 · WorkQuest",
  description:
    "The Living Performance Score for the WorkQuest OS. Stop evaluating people. Start observing performance.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await currentLocale();
  const dir = isRtl(locale) ? "rtl" : "ltr";
  return (
    <ClerkProvider>
      <html
        lang={locale}
        dir={dir}
        className={`${fraunces.variable} ${manrope.variable} ${cairo.variable} ${jbm.variable} h-full`}
      >
        <body className={`min-h-full antialiased bg-surface-50 text-ink-900 ${locale === "ar" ? "font-ar" : ""}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
