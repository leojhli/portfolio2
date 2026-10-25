// Centerline tracing of the user's actual transparent signature, in source pixels.
export const SIGNATURE_STROKES = [
  "M264 52 L193 153 L251 108 Q248 122 258 123 Q280 120 308 102 L330 82 Q307 102 299 114 Q292 124 329 112 L350 106 Q365 102 352 116 L323 139 Q347 105 359 86 Q363 80 362 73 Q360 58 391 45 Q405 37 403 46 Q401 85 344 150 L385 134",
  "M394 112 L395 113",
]
const points = [
  [264, 52],
  [193, 153],
  [251, 108],
  [251, 119],
  [258, 123],
  [280, 117],
  [308, 102],
  [330, 82],
  [307, 103],
  [299, 114],
  [303, 118],
  [329, 112],
  [350, 106],
  [357, 107],
  [352, 116],
  [323, 139],
  [345, 108],
  [359, 86],
  [362, 73],
  [365, 63],
  [378, 51],
  [391, 45],
  [403, 42],
  [400, 63],
  [390, 88],
  [370, 118],
  [344, 150],
  [385, 134],
]
const lengths = points
  .slice(1)
  .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]))
const total = lengths.reduce((a, b) => a + b, 0)
/** Character cells follow the same pen sequence instead of a left-to-right wipe. */
export function signatureProgress(x: number, y: number) {
  if (Math.hypot(x - 394.5, y - 112.5) < 6) return 0.97
  let best = Infinity,
    time = 0,
    walked = 0
  for (let i = 0; i < lengths.length; i++) {
    const a = points[i],
      b = points[i + 1],
      dx = b[0] - a[0],
      dy = b[1] - a[1]
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengths[i] ** 2),
    )
    const distance = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
    if (distance < best) {
      best = distance
      time = ((walked + t * lengths[i]) / total) * 0.94
    }
    walked += lengths[i]
  }
  return time
}
