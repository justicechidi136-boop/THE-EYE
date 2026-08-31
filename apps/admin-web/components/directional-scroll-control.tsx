"use client";

function visibleHorizontalScroller() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-admin-horizontal-scroll]"))
    .find((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < window.innerHeight && element.scrollWidth > element.clientWidth;
    });
}

export function DirectionalScrollControl() {
  const scrollVertical = (top: number) => window.scrollBy({ top, behavior: "smooth" });
  const scrollHorizontal = (left: number) => visibleHorizontalScroller()?.scrollBy({ left, behavior: "smooth" });
  const buttonClass = "pointer-events-auto grid size-10 place-items-center rounded-md border border-line bg-surface/90 text-lg font-semibold text-ink shadow-sm backdrop-blur hover:bg-surfaceMuted focus:outline-none focus:ring-2 focus:ring-eye";
  return (
    <nav className="pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 grid-cols-3 gap-1 opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100 lg:grid" aria-label="Page and table navigation">
      <span />
      <button type="button" className={buttonClass} aria-label="Scroll page up" title="Scroll page up" onClick={() => scrollVertical(-window.innerHeight * 0.7)}>↑</button>
      <span />
      <button type="button" className={buttonClass} aria-label="Scroll table left" title="Scroll visible table left" onClick={() => scrollHorizontal(-420)}>←</button>
      <button type="button" className={buttonClass} aria-label="Scroll page down" title="Scroll page down" onClick={() => scrollVertical(window.innerHeight * 0.7)}>↓</button>
      <button type="button" className={buttonClass} aria-label="Scroll table right" title="Scroll visible table right" onClick={() => scrollHorizontal(420)}>→</button>
    </nav>
  );
}
