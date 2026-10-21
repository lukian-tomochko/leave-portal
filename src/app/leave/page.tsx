import Link from "next/link";
import { redirect } from "next/navigation";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { createClient } from "@/lib/supabase/server";

// «My requests»: записи відпустки поточного працівника. Сторінка читає cookies, тож рендериться динамічно.
export default async function MyRequestsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const employeeId = data?.claims?.sub;
  if (!employeeId) {
    redirect("/login");
  }

  // RLS: працівник бачить лише власні записи.
  const records = await createSupabaseLeaveRepository(supabase).listRecords(employeeId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm underline">
        ← Головна
      </Link>
      <h1 className="text-2xl font-semibold">My requests</h1>
      <Link
        href="/leave/new"
        className="self-start rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Нова заявка
      </Link>

      {records.length === 0 ? (
        <p className="text-sm text-zinc-500">Заявок ще немає.</p>
      ) : (
        <table className="w-full text-left text-sm" data-testid="my-requests">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Hours</th>
              <th className="py-2 pr-4 font-medium">Position</th>
              <th className="py-2 pr-4 font-medium">Leave type</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4">{record.date}</td>
                <td className="py-2 pr-4">
                  {record.startsAt}–{record.endsAt}
                </td>
                <td className="py-2 pr-4">{record.positionLabel}</td>
                <td className="py-2 pr-4">{LEAVE_TYPE_LABELS[record.leaveType]}</td>
                <td className="py-2">{STATUS_LABELS[record.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
