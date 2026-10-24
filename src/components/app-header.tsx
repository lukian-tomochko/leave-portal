import { CalendarDaysIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "./nav-links";

// Шапка застосунку: назва порталу, навігація, хто увійшов і вихід.
// Без сесії (сторінка входу) показуємо лише назву. Це UX, а не захист: права перевіряють сторінки й база.
export async function AppHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const profile = claims
    ? (
        await supabase
          .from("profiles")
          .select("email, role")
          .eq("id", claims.sub)
          .maybeSingle()
      ).data
    : null;

  return (
    <header className="bg-header text-header-foreground">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2">
        <Link href="/" className="flex items-center gap-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <CalendarDaysIcon aria-hidden="true" className="size-5" />
          Портал відпусток
        </Link>
        {claims ? (
          <>
            <NavLinks />
            <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
              <span className="hidden text-header-muted sm:inline">{profile?.email ?? claims.email ?? ""}</span>
              {profile?.role ? <Badge variant="secondary">{profile.role}</Badge> : null}
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-header-muted hover:bg-header-foreground/10 hover:text-header-foreground"
                >
                  Вийти
                </Button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
