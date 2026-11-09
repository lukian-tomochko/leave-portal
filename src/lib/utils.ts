export { cn } from "cn"

// Рух появи (DESIGN.md, розділ 10): м'який fade із зсувом на 4 px. Для рядків списків додається stagger: затримка до 8 кроків.
export const APPEAR = "animate-in fade-in slide-in-from-bottom-1 duration-(--motion-base) ease-soft"
export const FADE_IN = "animate-in fade-in duration-(--motion-base) ease-soft"
export const stagger = (index: number) => ({ animationDelay: `${Math.min(index, 8) * 30}ms`, animationFillMode: "backwards" as const })
