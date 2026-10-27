// Стан форми подання заявки (useActionState). Лише типи: файл із "use server" не може експортувати нічого, крім дій.
import type { RequestInput } from "@/lib/leave/types";

export type SummaryLine = {
  date: string;
  hours: string; // "08:30–15:30"
  duration: string; // "7 h"
  position: string; // "Elementary school / Teacher"
  status: string; // "Awaiting decision"
};

export type LeaveFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "summary";
      warning: string | null; // попередження про перевищення балансу (AC-BALANCE-08, 15, 17)
      // Введені значення: форма підтвердження відправляє їх знову, а submitLeaveRequest перевіряє все наново.
      values: RequestInput;
      leaveTypeLabel: string;
      comment?: string; // показується в підсумку (AC-LEAVE-17)
      skippedDates: string[]; // дати без робочих годин, не прийняті (AC-LEAVE-21)
      lines: SummaryLine[];
    };
