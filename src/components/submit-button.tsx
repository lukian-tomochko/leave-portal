"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Кнопка відправки форми з простою server action (вхід, вихід): поки форма відправляється, перед підписом з'являється
// спінер, а кнопка стає недоступною. Підпис не змінюється (UAT і читачі з екрана бачать те саме слово).
export function SubmitButton({ children, ...props }: Omit<React.ComponentProps<typeof Button>, "type" | "disabled">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
