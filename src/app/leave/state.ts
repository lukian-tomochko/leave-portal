// Стан форми подання заявки (useActionState). Лише типи: файл із "use server" не може експортувати нічого, крім дій.
import type { LeaveType } from "@/lib/leave/types";

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
      // Введені значення: форма підтвердження відправляє їх знову, а submitLeaveRequest перевіряє все наново.
      values: { leaveType: LeaveType; dates: string[]; positionIds: string[] };
      leaveTypeLabel: string;
      lines: SummaryLine[];
    };
