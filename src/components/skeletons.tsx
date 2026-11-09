import { Skeleton } from "@/components/ui/skeleton";

// Скелетони для loading.tsx маршрутів: повторюють контейнер і розміри справжніх сторінок, щоб при появі даних макет не
// стрибав. Текстів немає (заголовків теж): стан «завантажується» — це aria-busy на main, а не друга копія h1.
const WIDTHS = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
} as const;

type Variant = "table" | "list" | "form" | "detail";

function Title() {
  return <Skeleton className="h-8 w-56" />;
}

function TableRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

function ListRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
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
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-8 w-40" />
    </div>
  );
}

export function PageSkeleton({ width, variant }: { width: keyof typeof WIDTHS; variant: Variant }) {
  return (
    <main aria-busy="true" className={`mx-auto flex w-full ${WIDTHS[width]} flex-1 flex-col gap-6 px-6 py-10`}>
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
