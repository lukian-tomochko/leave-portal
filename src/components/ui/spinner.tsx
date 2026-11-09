import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { cn } from "cn"

// Спінер для кнопок у стані pending. Лише декоративний (aria-hidden): підпис кнопки лишається тим самим,
// а про зайнятість каже aria-busy на кнопці чи формі.
function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2Icon>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden="true"
      className={cn("size-4 shrink-0 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
