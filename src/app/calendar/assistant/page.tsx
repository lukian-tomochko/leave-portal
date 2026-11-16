import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Tile } from "@/components/bento/tile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { ONLY_ADMIN_CALENDAR } from "@/lib/leave/messages";
import { createClient } from "@/lib/supabase/server";
import { AssistantPanel } from "./assistant-panel";

// «Calendar assistant»: лише адміністратор (AC-ASSIST-11). Не-адмін за прямим посиланням бачить повідомлення без форми й без
// пропозицій; дії перевіряють роль ще раз до моделі й до запису. Роль — з public.profiles, ніколи з user_metadata.
export default async function CalendarAssistantPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) {
    throw new Error(`calendar assistant(profile) failed: ${error.code ?? "unknown"}`);
  }

  if (profile?.role !== "admin") {
    return (
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-4 py-2">
        <PageHeader title="Calendar assistant" />
        <Alert variant="destructive">
          <AlertDescription>{ONLY_ADMIN_CALENDAR}</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex w-full max-w-3xl flex-1 flex-col gap-4 py-2">
      <PageHeader
        title="Calendar assistant"
        description="Paste the text of the school calendar. The assistant suggests closures; nothing is saved until you review and save them."
        actions={
          <Link href="/calendar/manage" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Add manually
          </Link>
        }
      />
      <Tile index={0}>
        <AssistantPanel />
      </Tile>
    </main>
  );
}
