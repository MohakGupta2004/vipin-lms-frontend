import { useEffect, useRef } from "react"

/**
 * Scrolls the element into view when it mounts, for forms that open on a button click.
 * Pair it with `scroll-mt-20` so the sticky app header doesn't cover the element's top.
 */
export function useScrollIntoView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }, [])
  return ref
}
