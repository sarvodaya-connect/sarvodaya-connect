import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";

import { availableLocales } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
import { getLocale, messagesFor } from "@/i18n/server";

import "./globals.css";

// Screen Catalogue v3 typeface.
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});

const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-sinhala",
  subsets: ["sinhala"],
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-tamil",
  subsets: ["tamil"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sarvodaya Connect | Administration Dashboard",
  description: "Administration dashboard for the Sarvodaya Connect platform",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${notoSans.variable} ${notoSinhala.variable} ${notoTamil.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider available={availableLocales()} locale={locale} messages={messagesFor(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}