import { CalendarPlusIcon, ListChecksIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Проєкт команди</h1>
        <p className="text-sm text-muted-foreground">Подавайте заявки на відпустку й стежте за їхнім статусом.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListChecksIcon aria-hidden="true" className="size-5 text-primary" />
              Мої заявки
            </CardTitle>
            <CardDescription>Усі записи відпустки зі статусами та коментарями.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/leave" className={buttonVariants({ variant: "outline" })}>
              Відкрити список
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarPlusIcon aria-hidden="true" className="size-5 text-primary" />
              Нова заявка
            </CardTitle>
            <CardDescription>Один день, кілька дат або конкретні години.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/leave/new" className={buttonVariants()}>
              Подати заявку
            </Link>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Обліковий запис</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd data-testid="user-email">{profile?.email ?? claims.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Роль</dt>
            <dd data-testid="user-role">{profile?.role ?? "профіль не знайдено"}</dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
