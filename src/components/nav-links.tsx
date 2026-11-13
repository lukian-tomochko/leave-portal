"use client";

import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ScaleIcon,
  type LucideIcon,
} from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// «Рішення» бачать лише менеджер і адміністратор: це UX, права перевіряють сторінки, дії й база.
const LINKS: { href: string; label: string; icon: LucideIcon; exact: boolean; deciders: boolean }[] = [
  { href: "/", label: "Home", icon: LayoutDashboardIcon, exact: true, deciders: false },
  { href: "/leave", label: "My requests", icon: ListChecksIcon, exact: false, deciders: false },
  { href: "/leave/new", label: "New request", icon: CalendarPlusIcon, exact: true, deciders: false },
  { href: "/balances", label: "Balances", icon: ScaleIcon, exact: false, deciders: false },
  { href: "/calendar", label: "Calendar", icon: CalendarDaysIcon, exact: false, deciders: false },
  { href: "/decisions", label: "Decisions", icon: InboxIcon, exact: false, deciders: true },
];

// Підпис пункту: поки клацнутий маршрут вантажиться, текст м'яко пульсує (useLinkStatus читає стан найближчого Link).
function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse" : undefined}>{label}</span>;
}

// Навігація сайдбара: активний пункт підсвічено «пілюлею», що ковзає між пунктами (spring), і позначено aria-current
// (не лише кольором). Бейдж біля «Рішення» показує, скільки записів чекає рішення.
export function NavLinks({ role, awaitingCount = 0 }: { role?: string | null; awaitingCount?: number }) {
  const canDecide = role === "manager" || role === "admin";
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
        {LINKS.filter((link) => !link.deciders || canDecide).map((link) => {
          const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
          // «My requests» не активний на /leave/new: у нього свій пункт.
          const isActive = link.href === "/leave" && pathname === "/leave/new" ? false : active;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-(--motion-fast) ease-soft outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId="nav-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl bg-primary-soft"
                  transition={{ type: "spring", stiffness: 220, damping: 28 }}
                />
              ) : null}
              <Icon aria-hidden="true" className={cn("relative size-[18px]", isActive && "text-primary")} />
              <span className="relative">
                <NavLabel label={link.label} />
              </span>
              {link.href === "/decisions" && awaitingCount > 0 ? (
                <span className="relative ml-auto animate-beat rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground tabular-nums">
                  {awaitingCount > 99 ? "99+" : awaitingCount}
                  <span className="sr-only"> awaiting a decision</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </MotionConfig>
  );
}
