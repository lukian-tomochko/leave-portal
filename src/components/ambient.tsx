// Фон: три великі кольорові плями повільно дрейфують (DESIGN.md, розділ 10). Лише декор, тож aria-hidden;
// при reduced-motion і режимі «спокійний» стоять на місці.
export function Ambient() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -top-[10vmax] -left-[12vmax] size-[46vmax] animate-drift rounded-full bg-blob-a opacity-55 blur-[70px]" />
      <div
        className="absolute top-[10vmax] -right-[14vmax] size-[46vmax] animate-drift rounded-full bg-blob-b opacity-55 blur-[70px]"
        style={{ animationDuration: "30s", animationDelay: "-8s" }}
      />
      <div
        className="absolute -bottom-[22vmax] left-[30vw] size-[46vmax] animate-drift rounded-full bg-blob-c opacity-55 blur-[70px]"
        style={{ animationDuration: "34s", animationDelay: "-14s" }}
      />
    </div>
  );
}
