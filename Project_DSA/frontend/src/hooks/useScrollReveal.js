import { useEffect } from "react";

export default function useScrollReveal(dependencies = []) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-scroll-reveal]"));

    if (elements.length === 0) {
      return undefined;
    }

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldReduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.14,
      },
    );

    elements.forEach((element, index) => {
      if (!element.style.getPropertyValue("--reveal-delay")) {
        element.style.setProperty("--reveal-delay", `${Math.min((index % 5) * 55, 220)}ms`);
      }

      const rect = element.getBoundingClientRect();
      const isAlreadyInView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;

      if (isAlreadyInView) {
        element.classList.add("is-visible");
        return;
      }

      observer.observe(element);
    });

    return () => observer.disconnect();
  }, dependencies);
}
