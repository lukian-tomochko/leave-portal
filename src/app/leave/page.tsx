import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Tile } from "@/components/bento/tile";
import { buttonVariants } from "@/components/ui/button";
import { parseStatusFilter } from "@/lib/leave/status-filter";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { listMyRecords } from "@/lib/leave/use-cases";
import { createClient } from "@/lib/supabase/server";
import { MyRequestsList } from "./my-requests-list";

// «My requests»: записи відпустки поточного працівника. Сторінка читає cookies, тож рендериться динамічно. Дані читаємо один раз,
// а фільтр за статусом працює в браузері (my-requests-list.tsx), без нового запиту до сервера.
export default async function MyRequestsPage({ searchParams }: PageProps<"/leave">) {
  const filter = parseStatusFilter((await searchParams).status);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const employeeId = data?.claims?.sub;
  if (!employeeId) {
    redirect("/login");
  }

  // RLS: працівник бачить лише власні записи.
  const records = await listMyRecords(createSupabaseLeaveRepository(supabase), employeeId);

  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <Link href="/" className="w-fit px-1 text-sm text-muted-foreground underline">
        ← Home
      </Link>
      <PageHeader
        title="My requests"
        actions={
          <Link href="/leave/new" className={buttonVariants()}>
            New request
          </Link>
        }
      />

      {records.length === 0 ? (
        <Tile index={0}>
          <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>
        </Tile>
      ) : (
        <MyRequestsList records={records} initialFilter={filter} />
      )}
    </main>
  );
}
