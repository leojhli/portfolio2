export type EffectDriver = {
  assemble(root: HTMLElement): void
  morph(root: HTMLElement): void
  disperse(root: HTMLElement, done: () => void): void
  cancel(): void
}
let driver: EffectDriver | null = null
export function connectEffects(next: EffectDriver) {
  driver = next
  return () => {
    if (driver === next) {
      next.cancel()
      driver = null
    }
  }
}
export const cancelEffects = () => driver?.cancel()
export const assemble = (root: HTMLElement | null) => {
  if (root) driver?.assemble(root)
}
export const disperse = (root: HTMLElement, done: () => void) =>
  driver ? driver.disperse(root, done) : done()
export function visiblePanel() {
  return (
    [...document.querySelectorAll<HTMLElement>("[data-panel]")].find((el) => {
      const r = el.getBoundingClientRect()
      return (
        r.left < innerWidth * 0.5 &&
        r.right > innerWidth * 0.5 &&
        r.top < innerHeight * 0.5 &&
        r.bottom > 0
      )
    }) ?? null
  )
}
export function morphPresentation() {
  const root =
    document.querySelector<HTMLElement>("dialog[open]") ?? visiblePanel()
  if (root) driver?.morph(root)
}
