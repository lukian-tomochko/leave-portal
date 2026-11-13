"use client";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Рядок таблиці, що з'являється по черзі: затримка за номером рядка (до 8 кроків по 60 мс після появи плитки).
export function RiseRow({ index, className, style, ...props }: React.ComponentProps<typeof TableRow> & { index: number }) {
  return <TableRow className={cn("animate-rise", className)} style={{ animationDelay: `${Math.min(index, 8) * 60 + 250}ms`, ...style }} {...props} />;
}
