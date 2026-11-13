import type { LeaveType } from "@/lib/leave/types";
import { cn } from "@/lib/utils";

// Кольоровий квадрат із літерою біля назви типу відпустки (як у прототипі): Sick «+», Personal «P», Unpaid «U», Family «F».
// Колір і літера лише додаються: назву типу завжди написано словами поруч, тож сам значок для читачів з екрана прихований.
const STYLE: Record<LeaveType, { letter: string; className: string }> = {
  sick: { letter: "+", className: "bg-status-rejected text-status-rejected-foreground" },
  personal: { letter: "P", className: "bg-accent text-accent-foreground" },
  unpaid: { letter: "U", className: "bg-status-cancelled text-status-cancelled-foreground" },
  family: { letter: "F", className: "bg-status-approved text-status-approved-foreground" },
};

export function LeaveTypeIcon({ type, className }: { type: LeaveType; className?: string }) {
  const { letter, className: tone } = STYLE[type];
  return (
    <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold", tone, className)}>
      {letter}
    </span>
  );
}
