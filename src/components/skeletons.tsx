import { Skeleton } from "@/components/ui/skeleton";

// Скелетони для loading.tsx маршрутів: повторюють контейнер і розміри справжніх сторінок, щоб при появі даних макет не
// стрибав. Текстів немає (заголовків теж): стан «завантажується» — це aria-busy на main, а не друга копія h1.
const WIDTHS = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "",
} as const;

type Variant = "table" | "list" | "form" | "detail";

function Title() {
  return <Skeleton className="h-9 w-56 rounded-2xl" />;
}

function TableRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-full rounded-2xl" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full rounded-2xl" />
      ))}
    </div>
  );
}

function ListRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  );
}

function FormFields() {
  return (
    <div className="flex flex-col gap-5">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-9 w-40 rounded-full" />
    </div>
  );
}

export function PageSkeleton({ width, variant }: { width: keyof typeof WIDTHS; variant: Variant }) {
  return (
    <main aria-busy="true" className={`flex w-full ${WIDTHS[width]} flex-1 flex-col gap-4 py-2`}>
      <Title />
      {variant === "table" ? <TableRows /> : null}
      {variant === "list" ? <ListRows /> : null}
      {variant === "form" ? <FormFields /> : null}
      {variant === "detail" ? (
        <>
          <ListRows rows={2} />
          <FormFields />
        </>
      ) : null}
    </main>
  );
}
