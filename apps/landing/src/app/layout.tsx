import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

// Screen Catalogue v3 typeface, same as the dashboard.
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sarvodayaconnect.com"),
  title: "Sarvodaya Connect | One record for every village society",
  description:
    "Sarvodaya Connect gives village societies and Sarvodaya staff a shared digital place to keep society records, submit documents and follow reviews from society to district to national level.",
  openGraph: {
    title: "Sarvodaya Connect",
    description:
      "One verified record for every Sarvodaya village society, on mobile and web.",
    url: "https://sarvodayaconnect.com",
    siteName: "Sarvodaya Connect",
    images: ["/brand/sarvodaya-connect-logo.jpg"],
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${notoSans.variable} antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
