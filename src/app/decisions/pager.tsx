import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Перехід між сторінками списку: сторінка в адресі (?page=N), без стану на клієнті.
export function Pager({ basePath, page, hasNext }: { basePath: string; page: number; hasNext: boolean }) {
  if (page <= 1 && !hasNext) {
    return null;
  }
  return (
    <nav aria-label="Сторінки списку" className="flex items-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={`${basePath}?page=${page - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Назад
        </Link>
      ) : null}
      <span className="text-muted-foreground">Сторінка {page}</span>
      {hasNext ? (
        <Link href={`${basePath}?page=${page + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Далі
        </Link>
      ) : null}
    </nav>
  );
}
