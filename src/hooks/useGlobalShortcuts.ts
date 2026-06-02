import { useEffect } from "react";

type Handler = (e: KeyboardEvent) => void;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useGlobalShortcuts(handler: Handler) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      // Allow Escape and Cmd/Ctrl+K even when typing
      const allowWhileTyping =
        e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k");
      if (isTypingTarget(e.target) && !allowWhileTyping) return;
      handler(e);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handler]);
}
