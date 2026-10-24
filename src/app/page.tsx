import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

// Головна сторінка шаблону: хто увійшов і з якою роллю (з таблиці profiles).
// Сторінка читає cookies, тому рендериться динамічно (шаблон зібрано з --no-cache-components).
export default async function Home() {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  // RLS: користувач бачить лише власний профіль.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Проєкт команди</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd data-testid="user-email">{profile?.email ?? claims.email ?? "—"}</dd>
        <dt className="text-muted-foreground">Роль</dt>
        <dd data-testid="user-role">{profile?.role ?? "профіль не знайдено"}</dd>
      </dl>
      <Link href="/leave" className={buttonVariants({ className: "self-start" })}>
        Мої заявки на відпустку
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Вийти
        </Button>
      </form>
    </main>
  );
}
