"use client";

import { useEffect, useState } from "react";

function visibleHorizontalScroller() {
  const reports = document.querySelector<HTMLElement>('[data-horizontal-scroll-region="reports"]');
  if (reports) return reports;

  return Array.from(document.querySelectorAll<HTMLElement>("[data-admin-horizontal-scroll]"))
    .find((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < window.innerHeight && element.scrollWidth > element.clientWidth;
    });
}

export function OnScreenNavigation() {
  const [mainContentVisible, setMainContentVisible] = useState(false);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const observer = new IntersectionObserver(
      ([entry]) => setMainContentVisible(entry?.isIntersecting ?? false),
      { threshold: 0 },
    );
    observer.observe(main);
    return () => observer.disconnect();
  }, []);

  const scrollVertical = (top: number) => window.scrollBy({ top, behavior: "smooth" });
  const scrollHorizontal = (left: number) => visibleHorizontalScroller()?.scrollBy({ left, behavior: "smooth" });
  const buttonClass = "nav-direction";

  return (
    <nav className={`on-screen-navigation${mainContentVisible ? "" : " on-screen-navigation-hidden"}`} aria-label="Page navigation">
      <button type="button" className={`${buttonClass} nav-up`} aria-label="Scroll page up" title="Scroll page up" onClick={() => scrollVertical(-window.innerHeight * 0.7)}>↑</button>
      <button type="button" className={`${buttonClass} nav-left`} aria-label="Scroll reports left" title="Scroll reports left" onClick={() => scrollHorizontal(-360)}>←</button>
      <button type="button" className={`${buttonClass} nav-down`} aria-label="Scroll page down" title="Scroll page down" onClick={() => scrollVertical(window.innerHeight * 0.7)}>↓</button>
      <button type="button" className={`${buttonClass} nav-right`} aria-label="Scroll reports right" title="Scroll reports right" onClick={() => scrollHorizontal(360)}>→</button>
    </nav>
  );
}
