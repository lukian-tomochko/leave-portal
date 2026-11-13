import { Skeleton } from "@/components/ui/skeleton";

// Скелетон головної: з'являється одразу після кліку, поки сервер збирає дані (інакше стара сторінка стоїть без відгуку).
// Розміри повторюють справжню bento-сітку, щоб макет не стрибав; текстів немає, стан «завантажується» — aria-busy на main.
export default function Loading() {
  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-4 py-2">
      <div className="flex flex-col gap-2 px-1">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-4 w-80 rounded-xl" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-8 h-52 rounded-3xl" />
        <Skeleton className="col-span-4 h-52 rounded-3xl" />
        <Skeleton className="col-span-4 h-44 rounded-3xl" />
        <Skeleton className="col-span-4 h-44 rounded-3xl" />
        <Skeleton className="col-span-4 h-44 rounded-3xl" />
        <Skeleton className="col-span-5 h-64 rounded-3xl" />
        <Skeleton className="col-span-4 h-64 rounded-3xl" />
        <Skeleton className="col-span-3 h-64 rounded-3xl" />
      </div>
    </main>
  );
}
