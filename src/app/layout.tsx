import type { Metadata } from "next";
import { Geist, Geist_Mono, Onest } from "next/font/google";
import { Ambient } from "@/components/ambient";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

// Cyrillic потрібен, бо інтерфейс українською: без нього Geist падає на системний шрифт.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// Display-шрифт для заголовків і великих чисел (ADR 0008): Onest містить кирилицю.
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Портал відпусток",
  description: "Заявки на відпустку, баланси, календар і рішення менеджера для персоналу школи",
};

// Тема й режим руху ставляться до першого малювання (guide «Preventing flash before hydration»): збережений вибір, інакше
// системна тема. suppressHydrationWarning на <html>, бо скрипт змінює атрибути до гідратації.
const BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage,t=s.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;if(s.getItem("motion")==="calm"){d.dataset.motion="calm"}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${onest.variable} h-full antialiased`}
    >
      <body className="relative min-h-full">
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <Ambient />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
