import type { Metadata } from "next";
import { ViewTransition } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Командний проєкт",
  description: "Next.js + Supabase + OpenSpec",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppHeader />
        {/* Кросфейд між сторінками (DESIGN.md, розділ 10); шапка не анімується (globals.css, site-header). */}
        <ViewTransition default="page-fade">{children}</ViewTransition>
      </body>
    </html>
  );
}
