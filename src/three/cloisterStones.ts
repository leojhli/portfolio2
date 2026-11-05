import * as THREE from "three"
import { stones } from "./cloisterChoreography"

type Stone = typeof stones["walk"]
type Point = [number, number, number]
type Course = {
  y: number
  inset: number
  ink?: number
}

/** The runner and the stonework share one set of world-space contact heights. */
export function buildCloisterStones(parent: THREE.Object3D) {
  const group = new THREE.Group()
  group.name = "Cloister bench and garden walls"
  const faces: number[] = []
  const lines: number[] = []
  const colors: number[] = []
  const chalk = new THREE.Color("#bcbcbc")
  let seed = 0x184ace
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }

  // Endpoints meet at corners. Small deviations between them give the profile
  // the slight wavering of a line drawn by hand at the scale of the cloister.
  function stroke(a: Point, b: Point, pressure: number) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const steps = Math.max(1, Math.ceil(length / 0.29))
    let from = a
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const wobble = i === steps ? 0 : Math.min(length * 0.012, 0.004)
      const to = a.map(
        (v, axis) => v + (b[axis] - v) * t + (random() - 0.5) * wobble,
      ) as Point
      const value = pressure * (0.87 + 0.13 * random())
      lines.push(...from, ...to)
      for (let j = 0; j < 2; j++)
        colors.push(chalk.r * value, chalk.g * value, chalk.b * value)
      from = to
    }
  }

  // Eight corners give the weathered edges a narrow chamfer. Horizontal
  // courses shape the footing, recessed wall face and stepped coping.
  function ring(stone: Stone, course: Course): Point[] {
    const x0 = stone.x - stone.width / 2 + course.inset
    const x1 = stone.x + stone.width / 2 - course.inset
    const z0 = stone.z - stone.depth / 2 + course.inset
    const z1 = stone.z + stone.depth / 2 - course.inset
    const cut = Math.min(0.033, (z1 - z0) * 0.09)
    const y = course.y
    return [
      [x0 + cut, y, z0],
      [x1 - cut, y, z0],
      [x1, y, z0 + cut],
      [x1, y, z1 - cut],
      [x1 - cut, y, z1],
      [x0 + cut, y, z1],
      [x0, y, z1 - cut],
      [x0, y, z0 + cut],
    ]
  }

  function block(stone: Stone, courses: Course[]) {
    let previous: Point[] | undefined
    for (const course of courses) {
      const rim = ring(stone, course)
      if (!previous) {
        for (let i = 1; i < rim.length - 1; i++)
          faces.push(...rim[0], ...rim[i + 1], ...rim[i])
      }
      for (let i = 0; i < rim.length; i++) {
        const j = (i + 1) % rim.length
        if (previous) {
          faces.push(
            ...previous[i],
            ...previous[j],
            ...rim[j],
            ...previous[i],
            ...rim[j],
            ...rim[i],
          )
          if (course.y - previous[i][1] > 0.13 && i % 2 === 0)
            stroke(previous[i], rim[i], 0.46)
        }
        if (course.ink) stroke(rim[i], rim[j], course.ink)
      }
      previous = rim
    }
    if (previous) {
      for (let i = 1; i < previous.length - 1; i++)
        faces.push(...previous[0], ...previous[i], ...previous[i + 1])
    }
  }

  function gardenWall(stone: Stone) {
    const h = stone.height
    block(stone, [
      { y: 0.012, inset: 0.025 },
      { y: 0.09, inset: 0.025, ink: 0.38 },
      { y: 0.13, inset: 0.055 },
      { y: h - 0.18, inset: 0.055, ink: 0.32 },
      { y: h - 0.14, inset: 0.025, ink: 0.48 },
      { y: h - 0.115, inset: 0 },
      { y: h - 0.025, inset: 0.009, ink: 0.4 },
      { y: h, inset: 0, ink: 0.89 },
    ])
    const left = stone.x - stone.width / 2
    const right = stone.x + stone.width / 2
    for (const side of [-1, 1]) {
      const z = stone.z + side * (stone.depth / 2 - 0.052)
      const middle = 0.457
      stroke([left + 0.088, middle, z], [right - 0.088, middle, z], 0.43)
      for (const [row, bottom, top] of [
        [0, 0.13, middle],
        [1, middle, h - 0.18],
      ]) {
        for (
          let x = left + (row ? 0.57 : 1.17);
          x < right - 0.25;
          x += 1.2 + random() * 0.38
        ) {
          stroke([x + 0.014, bottom, z], [x, top, z], 0.47)
        }
      }
    }
    // Only the slab divisions cross the walkable top.
    for (let x = left + 1.46; x < right - 0.45; x += 1.47 + random() * 0.35) {
      const front = stone.z - stone.depth / 2 + 0.027
      const back = stone.z + stone.depth / 2 - 0.027
      stroke([x, h + 0.003, front], [x + 0.018, h + 0.003, back], 0.49)
    }
  }
  gardenWall(stones.walk)
  gardenWall(stones.landing)

  const bench = stones.bench
  const apron = bench.height - 0.14
  for (const side of [-1, 1]) {
    const pier = {
      ...bench,
      x: bench.x + side * bench.width * 0.3,
      width: 0.32,
      depth: bench.depth - 0.04,
    }
    block(pier, [
      { y: 0.012, inset: 0.013 },
      { y: 0.095, inset: 0.013, ink: 0.54 },
      { y: 0.13, inset: 0.042 },
      { y: apron - 0.085, inset: 0.042, ink: 0.35 },
      { y: apron - 0.045, inset: 0.014, ink: 0.6 },
      { y: apron, inset: 0.014 },
    ])
  }
  block(bench, [
    { y: apron, inset: 0.032, ink: 0.52 },
    { y: apron + 0.03, inset: 0.008 },
    { y: bench.height - 0.027, inset: 0.007, ink: 0.48 },
    { y: bench.height, inset: 0, ink: 0.95 },
  ])

  const bodyGeometry = new THREE.BufferGeometry()
  bodyGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(faces, 3),
  )
  const bodyMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const inkGeometry = new THREE.BufferGeometry()
  inkGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(lines, 3),
  )
  inkGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
  const inkMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    transparent: true,
  })
  group.add(
    new THREE.Mesh(bodyGeometry, bodyMaterial),
    new THREE.LineSegments(inkGeometry, inkMaterial),
  )
  parent.add(group)

  let disposed = false
  return {
    setDistanceFade(pullback: number) {
      // Screen-space line segments otherwise keep their full width at any
      // distance, unlike the tapered, physical strokes of the original drawing.
      inkMaterial.opacity = 1 - 0.72 * pullback
    },
    dispose() {
      if (disposed) return
      disposed = true
      group.removeFromParent()
      bodyGeometry.dispose()
      inkGeometry.dispose()
      bodyMaterial.dispose()
      inkMaterial.dispose()
      group.clear()
    },
  }
}
