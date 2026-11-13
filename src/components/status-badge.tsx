import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/leave/messages";
import type { RecordStatus } from "@/lib/leave/types";

// Колір статусу лише додається до тексту (DESIGN.md): сам статус завжди написано словами.
export const STATUS_VARIANTS = {
  awaiting_decision: "awaiting",
  approved: "approved",
  rejected: "rejected",
  returned_for_revision: "returned",
  cancelled: "cancelled",
} as const satisfies Record<RecordStatus, "awaiting" | "approved" | "rejected" | "returned" | "cancelled">;

// Клас заливки статусу для діаграм і календарів (токени fill-*): колір завжди має поряд текстову легенду.
export const STATUS_FILL = {
  awaiting_decision: "bg-fill-awaiting",
  approved: "bg-fill-approved",
  rejected: "bg-fill-rejected",
  returned_for_revision: "bg-fill-returned",
  cancelled: "bg-fill-cancelled",
} as const satisfies Record<RecordStatus, string>;

export function StatusBadge({ status, className }: { status: RecordStatus; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
