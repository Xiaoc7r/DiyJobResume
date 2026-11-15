import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { MouseEvent } from "react";
import "./theme-transition.css";

export function revealRadius(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 2;
}
export function useAppearance() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("diyjobresume.appearance") === "dark";
    } catch {
      return false;
    }
  });
  const desired = useRef(dark),
    generation = useRef(0),
    active = useRef<ViewTransition | null>(null);
  const deadline = useRef<number | undefined>(undefined);
  const sheets = useRef(new Map<HTMLElement, string>());
  const style = useRef<HTMLStyleElement | null>(null);
  const cleanup = () => {
    window.clearTimeout(deadline.current);
    deadline.current = undefined;
    sheets.current.forEach((name, element) => {
      element.style.viewTransitionName = name;
    });
    sheets.current.clear();
    style.current?.remove();
    style.current = null;
  };
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    try {
      localStorage.setItem("diyjobresume.appearance", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(
    () => () => {
      generation.current++;
      active.current?.skipTransition();
      cleanup();
    },
    [],
  );
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = !desired.current;
    desired.current = next;
    const id = ++generation.current;
    active.current?.skipTransition();
    const apply = () => {
      if (id === generation.current) flushSync(() => setDark(next));
    };
    if (
      !document.startViewTransition ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.hidden
    ) {
      cleanup();
      active.current = null;
      apply();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect(),
      x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    // Give visible sheets their own stationary snapshot, above the changing UI.
    cleanup();
    const names: string[] = [];
    document
      .querySelectorAll<HTMLElement>(".resume-paper")
      .forEach((element) => {
        const box = element.getBoundingClientRect();
        if (
          !box.width ||
          !box.height ||
          box.bottom < 0 ||
          box.top > innerHeight ||
          (element.checkVisibility && !element.checkVisibility())
        )
          return;
        const name = `theme-sheet-${names.length}`;
        names.push(name);
        sheets.current.set(element, element.style.viewTransitionName);
        element.style.viewTransitionName = name;
      });
    style.current = document.createElement("style");
    style.current.textContent = names
      .map(
        (name) =>
          `::view-transition-group(${name}){animation:none;z-index:2}::view-transition-old(${name}){display:none}::view-transition-new(${name}){animation:none}`,
      )
      .join("");
    document.head.append(style.current);
    let transition: ViewTransition;
    try {
      transition = document.startViewTransition(apply);
    } catch {
      cleanup();
      active.current = null;
      apply();
      return;
    }
    active.current = transition;
    // Some compositors stop delivering frames mid-transition. Never leave the
    // document stuck behind a snapshot when the browser cannot finish it.
    deadline.current = window.setTimeout(() => {
      if (id !== generation.current) return;
      transition.skipTransition();
      apply();
      cleanup();
      active.current = null;
    }, 1800);
    void transition.ready
      .then(() => {
        if (id !== generation.current) return;
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${revealRadius(x, y, innerWidth, innerHeight)}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 460,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
            fill: "both",
          },
        );
      })
      .catch(() => {
        if (id === generation.current) {
          transition.skipTransition();
          apply();
        }
      });
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (id === generation.current) {
          cleanup();
          active.current = null;
        }
      });
  };
  return { dark, toggle };
}
