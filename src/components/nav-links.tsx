"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// «Рішення» бачать лише менеджер і адміністратор: це UX, права перевіряють сторінки, дії й база.
const LINKS = [
  { href: "/", label: "Головна", exact: true, deciders: false },
  { href: "/leave", label: "Мої заявки", exact: false, deciders: false },
  { href: "/leave/new", label: "Нова заявка", exact: true, deciders: false },
  { href: "/decisions", label: "Рішення", exact: false, deciders: true },
];

// Навігація шапки: активний пункт підсвічено й позначено aria-current (не лише кольором).
export function NavLinks({ role }: { role?: string | null }) {
  const canDecide = role === "manager" || role === "admin";
  const pathname = usePathname();

  return (
    <nav aria-label="Головна навігація" className="flex flex-wrap items-center gap-1">
      {LINKS.filter((link) => !link.deciders || canDecide).map((link) => {
        const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
        // «My requests» не активний на /leave/new: у нього свій пункт.
        const isActive = link.href === "/leave" && pathname === "/leave/new" ? false : active;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              isActive
                ? "bg-header-foreground/15 text-header-foreground"
                : "text-header-muted hover:bg-header-foreground/10 hover:text-header-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
