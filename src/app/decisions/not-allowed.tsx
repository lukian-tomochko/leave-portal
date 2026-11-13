import { PageHeader } from "@/components/bento/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NOT_ALLOWED } from "@/lib/leave/decision";

// Відмова в доступі до списків рішень: сторінка з поясненням без даних (рольова перевірка тут UX; права тримають дії й RLS).
export function NotAllowed({ title }: { title: string }) {
  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <PageHeader title={title} />
      <Alert variant="destructive">
        <AlertDescription>{NOT_ALLOWED}</AlertDescription>
      </Alert>
    </main>
  );
}
