// A button with the sentence that says what pressing it does and when to press it, on the same
// row and across the whole width beside it (AGENTS.md, definition of done 4: every button in the
// admin area explains itself beside it, never only on hover; Patric, 2026-10-06: the text "could
// be full width", placed with its button). On a phone the sentence goes under the button.
export function Explained({ what, children }: { what: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <div className="shrink-0">{children}</div>
      <p className="text-sm text-muted-foreground">{what}</p>
    </div>
  );
}
