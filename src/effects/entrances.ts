type EntranceOptions = {
  delay?: number
  direction?: number
}

/** Compositor-only entrances. Content stays readable without JavaScript/motion. */
export function animateEntrance(
  root: HTMLElement,
  options: EntranceOptions = {},
) {
  if (document.documentElement.dataset.motion !== "on") return () => {}
  const candidates = [...root.querySelectorAll<HTMLElement>("[data-reveal]")]
  // A visual group animates once; nested reveals never compound transforms.
  const groups = candidates.filter((el) => {
    const parent = el.parentElement?.closest("[data-reveal]")
    return !parent || !root.contains(parent)
  })
  const targets = (groups.length ? groups : [root]).slice(0, 24)
  const animations: Animation[] = []
  const x = Math.sign(options.direction ?? 0) * 8
  const ascii = document.documentElement.dataset.mode === "ascii"
  for (const [i, el] of targets.entries()) {
    if (typeof el.animate !== "function") continue
    animations.push(
      el.animate(
        ascii
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: `translate3d(${x}px,16px,0)` },
              { opacity: 1, transform: "translate3d(0,0,0)" },
            ],
        {
          duration: 620,
          delay: (options.delay ?? 0) + Math.min(i * 32, 160),
          easing: "cubic-bezier(0.16,1,0.3,1)",
          fill: "backwards",
        },
      ),
    )
  }
  const stop = () => {
    animations.forEach((animation) => animation.cancel())
    root.removeEventListener("focusin", stop)
  }
  // Keyboard focus never waits for an entrance to reveal its target.
  root.addEventListener("focusin", stop)
  return stop
}
