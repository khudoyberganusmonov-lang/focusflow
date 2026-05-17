/** Top strip for window drag (hiddenInset). Spacer leaves traffic lights clickable. */
export default function TitleBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-12 z-[60] flex pointer-events-none"
      aria-hidden
    >
      <div className="w-[78px] shrink-0" />
      <div className="flex-1 h-full drag-region" />
    </div>
  );
}
