import { CalendarDaysIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { signOut } from "@/app/login/actions";
import { getAwaitingCount, getClaims, getProfile } from "@/lib/supabase/session";
import { MotionToggle, ThemeToggle } from "./appearance-controls";
import { NavLinks } from "./nav-links";
import { SubmitButton } from "./submit-button";

// Навігація з бейджем черги: лічильник — допоміжний, тому його збій не ховає навігацію, а сам лічильник вантажиться потоком
// (Suspense), не блокуючи ні сайдбар, ні сторінку.
async function NavWithQueue({ userId, role }: { userId: string; role: string }) {
  let awaiting = 0;
  try {
    awaiting = await getAwaitingCount(userId);
  } catch {
    awaiting = 0;
  }
  return <NavLinks role={role} awaitingCount={awaiting} />;
}

// Каркас застосунку: лівий сайдбар (назва, навігація, вигляд, хто увійшов, вихід) і контент поруч.
// Без сесії (сторінка входу) сайдбара немає. Це UX, а не захист: права перевіряють сторінки й база.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const claims = await getClaims();

  if (!claims) {
    return <div className="relative z-10 flex min-h-screen flex-col">{children}</div>;
  }

  const profile = await getProfile(claims.sub);
  const role = profile?.role;
  const email = profile?.email ?? claims.email ?? "";
  const name = profile?.full_name ?? email;
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-[248px_minmax(0,1fr)] gap-4 p-4">
      <aside className="sticky top-4 flex h-[calc(100vh-2rem)] min-h-[620px] flex-col gap-4 overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-tile">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-2 py-1 font-display text-lg font-bold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="grid size-9 animate-wobble place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDaysIcon aria-hidden="true" className="size-5" />
          </span>
          Портал відпусток
        </Link>
        {role === "manager" || role === "admin" ? (
          <Suspense fallback={<NavLinks role={role} />}>
            <NavWithQueue userId={claims.sub} role={role} />
          </Suspense>
        ) : (
          <NavLinks role={role} />
        )}
        <div className="mt-auto flex flex-col gap-1">
          <ThemeToggle />
          <MotionToggle />
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-muted p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            {initials}
          </span>
          <div className="min-w-0 text-xs">
            <p className="truncate font-semibold text-foreground">{profile?.full_name ?? "Користувач"}</p>
            <p className="truncate text-muted-foreground" data-testid="user-email">
              {email}
            </p>
            {role ? (
              <p className="text-muted-foreground" data-testid="user-role">
                {role}
              </p>
            ) : null}
          </div>
        </div>
        <form action={signOut}>
          <SubmitButton variant="ghost" size="sm" className="w-full justify-start gap-3 rounded-xl px-3 text-muted-foreground">
            <LogOutIcon aria-hidden="true" />
            Вийти
          </SubmitButton>
        </form>
      </aside>
      <div className="flex min-w-0 flex-col">
        {/* Повільний перехід між маршрутами (globals.css, page-out і bloom блоків); оновлення параметрів не анімуємо. */}
        <ViewTransition enter="page-in" exit="page-out" default="none">
          {children}
        </ViewTransition>
      </div>
    </div>
  );
}
