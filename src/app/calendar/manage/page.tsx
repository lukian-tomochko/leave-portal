import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { describeClosure } from "@/lib/leave/closures";
import { ONLY_ADMIN_CALENDAR } from "@/lib/leave/messages";
import { trimSeconds } from "@/lib/leave/time";
import { createClient } from "@/lib/supabase/server";
import { ClosureForm } from "./closure-form";
import { ClosureList } from "./closure-list";

// «Керувати календарем»: лише адміністратор (AC-CAL-12). Не-адмін за прямим посиланням бачить повідомлення без форми й
// без даних; зміни перевіряють дії й база (AC-CAL-13). Роль — з public.profiles, ніколи з user_metadata.
export default async function ManageCalendarPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profileError) {
    throw new Error(`manage calendar(profile) failed: ${profileError.code ?? "unknown"}`);
  }

  if (profile?.role !== "admin") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold">Керування календарем</h1>
        <Alert variant="destructive">
          <AlertDescription>{ONLY_ADMIN_CALENDAR}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const { data: rows, error } = await supabase
    .from("school_closures")
    .select("id, name, starts_on, ends_on, closed_from")
    .order("starts_on");
  if (error) {
    throw new Error(`manage calendar failed: ${error.code ?? "unknown"}`);
  }
  const closures = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    dates: describeClosure({
      name: row.name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      closedFrom: row.closed_from === null ? null : trimSeconds(row.closed_from),
    }),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Керування календарем</h1>
        <Link href="/calendar" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Шкільний календар
        </Link>
      </div>
      <ClosureForm />
      <section aria-labelledby="closures-title" className="flex flex-col gap-3">
        <h2 id="closures-title" className="text-lg font-semibold">
          Усі закриття
        </h2>
        {closures.length === 0 ? (
          <p className="text-sm text-muted-foreground">Закриттів ще немає.</p>
        ) : (
          <ClosureList rows={closures} />
        )}
      </section>
    </main>
  );
}
