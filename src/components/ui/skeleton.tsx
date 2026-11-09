import * as React from "react"
import { cn } from "cn"

// Заглушка на час завантаження: пульсує, колір лише з токена muted. Для читачів з екрана сховано (aria-hidden):
// стан «завантажується» повідомляє контейнер через aria-busy, а не десятки порожніх блоків.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
