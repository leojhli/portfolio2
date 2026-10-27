import * as THREE from "three"

/** Original modeled fan-art figures, built at human scale for the walking camera. */
export function createSpiritCharacters(root: THREE.Group) {
  const fabric = (color: string, roughness = 0.88) =>
    new THREE.MeshStandardMaterial({ color, roughness })
  const robe = fabric("#111622"),
    fold = fabric("#263044"),
    seam = fabric("#3c4557"),
    white = fabric("#e7e9df"),
    silk = fabric("#b8c3d0", 0.52),
    skin = fabric("#dfbca5", 0.7),
    shade = fabric("#b78676"),
    orange = fabric("#c95b1c", 0.65),
    orangeTip = fabric("#e68e35", 0.68),
    hair = fabric("#111522", 0.5),
    hairGlint = fabric("#33364b", 0.5),
    eye = fabric("#f3eee6", 0.5),
    amber = fabric("#69452b", 0.5),
    violet = fabric("#635775", 0.5),
    steel = new THREE.MeshStandardMaterial({
      color: "#b1bdca",
      metalness: 0.82,
      roughness: 0.25,
    }),
    blackSteel = new THREE.MeshStandardMaterial({
      color: "#101823",
      metalness: 0.6,
      roughness: 0.32,
    })
  const materials = {
    robe,
    fold,
    seam,
    white,
    silk,
    skin,
    shade,
    orange,
    orangeTip,
    hair,
    hairGlint,
    eye,
    amber,
    violet,
    steel,
    blackSteel,
  }
  for (const [name, material] of Object.entries(materials))
    material.name = `Soul reaper / ${name}`
  const add = (
    g: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    g.add(mesh)
    return mesh
  }
  const box = (
    g: THREE.Object3D,
    material: THREE.Material,
    size: number[],
    position: number[],
  ) =>
    add(
      g,
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      material,
      ...position as [number, number, number],
    )
  const sphere = (
    g: THREE.Object3D,
    material: THREE.Material,
    position: number[],
    size: number[],
    detail = 12,
  ) => {
    const mesh = add(
      g,
      new THREE.SphereGeometry(1, detail, Math.max(6, detail / 2)),
      material,
      ...position as [number, number, number],
    )
    mesh.scale.set(size[0], size[1], size[2])
    return mesh
  }
  const cord = (
    g: THREE.Object3D,
    points: number[][],
    material: THREE.Material,
    radius: number,
    segments = 14,
  ) =>
    add(
      g,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          points.map(
            (p) => new THREE.Vector3(...p as [number, number, number]),
          ),
        ),
        segments,
        radius,
        5,
        false,
      ),
      material,
    )
  // Open cloth surfaces have explicit thickness/underlayers, allowing material batching.
  const cloth = (
    g: THREE.Object3D,
    material: THREE.Material,
    points: number[][],
    thickness = 0.009,
  ) => {
    const shape = new THREE.Shape(
      points.map((p) => new THREE.Vector2(p[0], p[1])),
    )
    const mesh = add(
      g,
      new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
      }),
      material,
    )
    return mesh
  }
  const shell = (
    g: THREE.Object3D,
    material: THREE.Material,
    rings: number[][],
    count: number,
    pleats = 0,
  ) => {
    const positions: number[] = [],
      uv: number[] = [],
      index: number[] = []
    rings.forEach(([y, rx, rz], row) => {
      for (let j = 0; j <= count; j++) {
        const angle = (j / count) * Math.PI * 2
        const ripple =
          1 + pleats * Math.cos(angle * 12) * (1 - row / rings.length)
        positions.push(
          Math.sin(angle) * rx * ripple,
          y,
          Math.cos(angle) * rz * ripple,
        )
        uv.push(j / count, row / (rings.length - 1))
        if (row && j) {
          const a = row * (count + 1) + j,
            b = a - count - 1
          index.push(a - 1, b, a, a - 1, b - 1, b)
        }
      }
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    )
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
    geometry.setIndex(index)
    geometry.computeVertexNormals()
    return add(g, geometry, material)
  }
  const lock = (
    g: THREE.Object3D,
    material: THREE.Material,
    base: number[],
    tip: number[],
    width: number,
  ) => {
    const a = new THREE.Vector3(...base as [number, number, number]),
      b = new THREE.Vector3(...tip as [number, number, number])
    const mesh = add(
      g,
      new THREE.ConeGeometry(width, a.distanceTo(b), 5),
      material,
    )
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    )
    return mesh
  }
  const head = (g: THREE.Group, kind: string) => {
    // Subtle jaw taper rather than a spherical toy head.
    const geometry = new THREE.SphereGeometry(1, 20, 14)
    const p = geometry.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i),
        jaw = y < -0.15 ? 1 + (y + 0.15) * 0.25 : 1
      p.setXYZ(
        i,
        p.getX(i) * 0.117 * jaw,
        y * 0.155,
        p.getZ(i) * 0.105 * (y < -0.4 ? 0.9 : 1),
      )
    }
    geometry.computeVertexNormals()
    add(g, geometry, skin, 0, 1.67, 0.005)
    add(
      g,
      new THREE.CylinderGeometry(0.045, 0.052, 0.115, 12),
      skin,
      0,
      1.49,
      0,
    )
    for (const side of [-1, 1]) {
      sphere(g, skin, [side * 0.115, 1.655, 0], [0.026, 0.042, 0.022], 10)
      sphere(g, shade, [side * 0.128, 1.655, 0.009], [0.008, 0.025, 0.012], 8)
      // Layered almond eyes with darker upper lid, pupil and a tiny catch-light.
      const almond = new THREE.Shape()
      almond.moveTo(-0.037, 0)
      almond.quadraticCurveTo(-0.012, 0.026, 0.037, 0.008)
      almond.quadraticCurveTo(0.015, -0.017, -0.037, 0)
      const eyeWhite = add(
        g,
        new THREE.ShapeGeometry(almond, 6),
        eye,
        side * 0.052,
        1.681,
        0.098,
      )
      eyeWhite.rotation.y = side * 0.22
      sphere(
        g,
        kind === "Ichigo" ? amber : violet,
        [side * 0.053, 1.686, 0.107],
        [0.013, 0.015, 0.004],
        10,
      )
      sphere(g, hair, [side * 0.053, 1.687, 0.111], [0.0055, 0.011, 0.0025], 8)
      sphere(g, eye, [side * 0.057, 1.692, 0.114], [0.0025, 0.003, 0.0012], 6)
      cord(
        g,
        [
          [side * 0.087, 1.691, 0.089],
          [side * 0.054, 1.704, 0.103],
          [side * 0.019, 1.693, 0.103],
        ],
        hair,
        0.0035,
        6,
      )
      cord(
        g,
        [
          [side * 0.084, 1.725, 0.088],
          [side * 0.052, 1.73, 0.102],
          [side * 0.02, 1.721, 0.107],
        ],
        kind === "Ichigo" ? orange : hair,
        0.005,
        6,
      )
    }
    const nose = add(
      g,
      new THREE.ConeGeometry(0.016, 0.051, 4),
      skin,
      0,
      1.649,
      0.108,
    )
    nose.rotation.x = Math.PI * 0.28
    cord(
      g,
      [
        [-0.019, 1.593, 0.09],
        [0, 1.589, 0.097],
        [0.019, 1.594, 0.09],
      ],
      shade,
      0.0024,
      6,
    )
    // Hair has a fitted cap plus individually modeled overlapping locks.
    const cap = add(
      g,
      new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      kind === "Ichigo" ? orange : hair,
      0,
      1.699,
      -0.008,
    )
    cap.scale.set(0.125, 0.141, 0.117)
    if (kind === "Ichigo") {
      for (let i = 0; i < 28; i++) {
        const angle = i * 2.399,
          ring = 0.045 + (i % 4) * 0.019
        const x = Math.cos(angle) * ring,
          z = Math.sin(angle) * ring
        const y = 1.777 + Math.sqrt(Math.max(0, 0.014 - ring * ring)) * 0.25
        lock(
          g,
          i % 4 ? orange : orangeTip,
          [x, y, z],
          [x * 1.45, y + 0.07 + (i % 3) * 0.018, z * 1.5],
          0.024 + (i % 3) * 0.004,
        )
      }
      for (let i = -3; i <= 3; i++)
        lock(
          g,
          orange,
          [i * 0.027, 1.79, 0.068],
          [i * 0.027 + 0.012, 1.72 + Math.abs(i) * 0.002, 0.119],
          0.023,
        )
    } else {
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2
        const x = Math.sin(angle) * 0.111,
          z = Math.cos(angle) * 0.108
        const isBack = z < 0.01
        const length = kind === "Byakuya" && isBack ? 0.43 : 0.2
        lock(
          g,
          i % 4 ? hair : hairGlint,
          [x, 1.77, z - 0.01],
          [x * 1.18, 1.77 - length - (i % 3) * 0.018, z - 0.025],
          0.037,
        )
      }
      // An asymmetric front sweep leaves both eyes readable at walking distance.
      for (let i = 0; i < 5; i++)
        lock(
          g,
          hair,
          [-0.09 + i * 0.043, 1.795, 0.067],
          [-0.06 + i * 0.037, 1.7 - (i % 2) * 0.036, 0.121],
          0.035,
        )
      if (kind === "Byakuya") {
        for (const side of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            const ornament = box(g, silk, [0.022, 0.073, 0.024], [
              side * (0.055 + i * 0.018),
              1.799 + (i % 2) * 0.006,
              0.072 - i * 0.02,
            ])
            ornament.rotation.z = -side * 0.17
          }
        }
      }
    }
  }
  const sleeve = (g: THREE.Group, side: number) => {
    const arm = new THREE.Group()
    arm.position.set(side * 0.19, 1.375, 0)
    arm.rotation.z = side * 0.19
    g.add(arm)
    const tube = shell(
      arm,
      robe,
      [
        [-0.42, 0.1, 0.087],
        [-0.32, 0.115, 0.092],
        [-0.1, 0.118, 0.09],
        [0.045, 0.088, 0.077],
      ],
      18,
      0.035,
    )
    tube.name = "Layered kimono sleeve"
    const cuff = add(
      arm,
      new THREE.TorusGeometry(0.078, 0.007, 5, 16),
      fold,
      0,
      -0.42,
      0,
    )
    cuff.rotation.x = Math.PI / 2
    cuff.scale.set(1.25, 1, 1)
    // The visible hand has a palm, four fingers and a thumb.
    sphere(arm, skin, [0, -0.465, 0.008], [0.045, 0.07, 0.027], 12)
    for (let i = 0; i < 4; i++) {
      const finger = add(
        arm,
        new THREE.CapsuleGeometry(
          0.009,
          0.038 - Math.abs(i - 1.5) * 0.005,
          3,
          5,
        ),
        skin,
        -0.027 + i * 0.017,
        -0.521,
        0.012,
      )
      finger.rotation.z = (i - 1.5) * 0.045
    }
    const thumb = add(
      arm,
      new THREE.CapsuleGeometry(0.012, 0.032, 3, 6),
      skin,
      side * 0.043,
      -0.475,
      0.024,
    )
    thumb.rotation.z = -side * 0.45
    for (let i = 0; i < 3; i++)
      cord(
        arm,
        [
          [-0.065, -0.17 - i * 0.065, 0.075],
          [0, -0.21 - i * 0.065, 0.092],
          [0.073, -0.18 - i * 0.065, 0.075],
        ],
        fold,
        0.003,
        7,
      )
  }
  const sword = (g: THREE.Group, kind: string) => {
    const weapon = new THREE.Group()
    weapon.name =
      kind === "Ichigo"
        ? "Tensa Zangetsu"
        : kind === "Rukia"
          ? "Sode no Shirayuki"
          : "Senbonzakura"
    weapon.position.set(0.3, 0.9, 0.035)
    weapon.rotation.z = -0.14
    weapon.rotation.y = -0.25
    g.add(weapon)
    const isWhite = kind === "Rukia",
      hilt = isWhite ? white : blackSteel
    add(
      weapon,
      new THREE.CylinderGeometry(0.017, 0.019, 0.19, 10),
      hilt,
      0,
      0.1,
      0,
    )
    for (let i = 0; i < 9; i++) {
      const wrap = add(
        weapon,
        new THREE.TorusGeometry(0.019, 0.0027, 4, 10),
        isWhite ? silk : fold,
        0,
        0.025 + i * 0.018,
        0,
      )
      wrap.rotation.x = Math.PI / 2
      wrap.rotation.y = 0.25
    }
    const blade = new THREE.Shape()
    blade.moveTo(-0.014, 0)
    blade.lineTo(0.016, 0)
    blade.quadraticCurveTo(0.014, -0.44, -0.006, -0.8)
    blade.lineTo(-0.027, -0.865)
    blade.quadraticCurveTo(-0.021, -0.44, -0.014, 0)
    add(
      weapon,
      new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: false }),
      kind === "Ichigo" ? blackSteel : steel,
    )
    cord(
      weapon,
      [
        [0.015, 0, 0.006],
        [0.007, -0.43, 0.006],
        [-0.008, -0.79, 0.006],
        [-0.026, -0.863, 0.006],
      ],
      steel,
      0.0017,
      16,
    )
    if (kind === "Ichigo") {
      // Four bent prongs read as the familiar compact Bankai guard.
      for (let i = 0; i < 4; i++) {
        const prong = new THREE.Group()
        prong.rotation.y = (i * Math.PI) / 2
        weapon.add(prong)
        box(prong, blackSteel, [0.063, 0.016, 0.016], [0.031, 0, 0])
        box(prong, blackSteel, [0.016, 0.016, 0.04], [0.055, 0, 0.013])
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 11) * Math.PI
        const link = add(
          weapon,
          new THREE.TorusGeometry(0.012, 0.0032, 4, 8),
          blackSteel,
          Math.sin(a) * 0.07,
          0.206 - i * 0.012,
          -0.013 - i * 0.006,
        )
        link.rotation.y = ((i % 2) * Math.PI) / 2
      }
    } else {
      const guard = add(
        weapon,
        new THREE.TorusGeometry(0.05, 0.007, 5, 16),
        isWhite ? white : steel,
      )
      guard.rotation.x = Math.PI / 2
      if (isWhite)
        cord(
          weapon,
          [
            [0, 0.2, 0],
            [-0.04, 0.15, -0.03],
            [-0.07, -0.03, -0.055],
            [-0.04, -0.21, -0.1],
            [0.02, -0.26, -0.15],
          ],
          white,
          0.009,
          24,
        )
    }
    return weapon
  }
  const character = (name: string, x: number, z: number, scale: number) => {
    const g = new THREE.Group()
    g.name = name
    g.position.set(x, 0.15, z)
    g.scale.setScalar(scale)
    root.add(g)
    // Separate legs, tabi and segmented sandals beneath the folded hakama hem.
    for (const side of [-1, 1]) {
      const leg = add(
        g,
        new THREE.CylinderGeometry(0.055, 0.067, 0.37, 12),
        robe,
        side * 0.1,
        0.265,
        0,
      )
      leg.rotation.z = side * 0.02
      sphere(g, white, [side * 0.1, 0.095, 0.04], [0.062, 0.065, 0.112], 12)
      const sandal = sphere(
        g,
        blackSteel,
        [side * 0.1, 0.038, 0.055],
        [0.072, 0.022, 0.13],
        12,
      )
      sandal.name = "Straw sandal sole"
      for (let i = 0; i < 7; i++)
        box(g, silk, [0.115, 0.005, 0.011], [
          side * 0.1,
          0.06,
          -0.04 + i * 0.025,
        ])
      cord(
        g,
        [
          [side * 0.1 - 0.053, 0.087, -0.01],
          [side * 0.1, 0.128, 0.081],
          [side * 0.1 + 0.053, 0.087, -0.01],
        ],
        robe,
        0.012,
        8,
      )
    }
    shell(
      g,
      robe,
      [
        [0.16, 0.28, 0.19],
        [0.3, 0.27, 0.19],
        [0.7, 0.23, 0.165],
        [1.04, 0.17, 0.115],
      ],
      48,
      0.09,
    ).name = "Pleated hakama"
    for (let i = -3; i <= 3; i++)
      cord(
        g,
        [
          [i * 0.048, 0.97, 0.12],
          [i * 0.065, 0.66, 0.163],
          [i * 0.078, 0.2, 0.185],
        ],
        i % 2 ? fold : seam,
        0.003,
        12,
      )
    shell(
      g,
      robe,
      [
        [0.99, 0.16, 0.115],
        [1.12, 0.19, 0.12],
        [1.33, 0.245, 0.135],
        [1.425, 0.205, 0.105],
      ],
      28,
      0.02,
    ).name = "Cross-wrap jacket"
    for (const side of [-1, 1]) {
      const inner = cloth(
        g,
        white,
        [
          [side * 0.055, 1.49],
          [side * 0.105, 1.41],
          [-side * 0.035, 1.12],
          [-side * 0.065, 1.16],
        ],
        0.008,
      )
      inner.position.z = 0.127
      const collar = cloth(
        g,
        name === "Ichigo" ? fold : robe,
        [
          [side * 0.09, 1.445],
          [side * 0.139, 1.4],
          [-side * 0.01, 1.08],
          [-side * 0.045, 1.105],
        ],
        0.008,
      )
      collar.position.z = 0.139
      sleeve(g, side)
    }
    shell(
      g,
      name === "Ichigo" ? fold : white,
      [
        [0.99, 0.177, 0.127],
        [1.075, 0.181, 0.13],
      ],
      28,
    ).name = "Obi sash"
    const knot = sphere(
      g,
      name === "Ichigo" ? fold : white,
      [0, 1.033, 0.143],
      [0.05, 0.035, 0.024],
      10,
    )
    knot.rotation.z = 0.2
    const sash = cloth(
      g,
      name === "Ichigo" ? fold : white,
      [
        [-0.025, 1.04],
        [0.025, 1.04],
        [0.065, 0.81],
        [0.028, 0.79],
      ],
      0.008,
    )
    sash.position.z = 0.15
    if (name === "Ichigo") {
      // His fitted Bankai coat has a long, divided, jagged lower silhouette.
      for (const side of [-1, 1]) {
        const tail = cloth(
          g,
          robe,
          [
            [side * 0.16, 1.02],
            [side * 0.2, 0.75],
            [side * 0.29, 0.23],
            [side * 0.19, 0.29],
            [side * 0.12, 0.2],
            [side * 0.06, 0.42],
          ],
          0.014,
        )
        tail.position.z = -0.16
      }
      for (let i = 0; i < 4; i++)
        sphere(
          g,
          blackSteel,
          [0.045, 1.16 + i * 0.055, 0.15],
          [0.009, 0.009, 0.004],
          6,
        )
    }
    if (name === "Byakuya") {
      // Open captain's haori: shoulder yoke, two front panels and a long back.
      const back = cloth(
        g,
        white,
        [
          [-0.255, 1.43],
          [0.255, 1.43],
          [0.25, 0.98],
          [0.31, 0.34],
          [0.02, 0.38],
          [0, 0.57],
          [-0.025, 0.38],
          [-0.31, 0.34],
        ],
        0.016,
      )
      back.position.z = -0.14
      for (const side of [-1, 1]) {
        const front = cloth(
          g,
          white,
          [
            [side * 0.11, 1.46],
            [side * 0.26, 1.42],
            [side * 0.21, 1.05],
            [side * 0.27, 0.4],
            [side * 0.12, 0.39],
            [side * 0.08, 1.05],
          ],
          0.014,
        )
        front.position.z = 0.15
        cord(
          g,
          [
            [side * 0.18, 1.28, 0.17],
            [side * 0.17, 0.94, 0.17],
            [side * 0.22, 0.48, 0.17],
          ],
          silk,
          0.003,
          14,
        )
        const shoulder = box(g, white, [0.16, 0.045, 0.3], [
          side * 0.2,
          1.43,
          0,
        ])
        shoulder.rotation.z = -side * 0.1
      }
      // Six geometric petals on the back medallion remain legible without a font.
      const badge = add(
        g,
        new THREE.CylinderGeometry(0.07, 0.07, 0.006, 6),
        blackSteel,
        0,
        1.23,
        -0.154,
      )
      badge.rotation.x = Math.PI / 2
      for (let i = 0; i < 6; i++) {
        const petal = sphere(
          g,
          white,
          [
            Math.sin((i * Math.PI) / 3) * 0.035,
            1.23 + Math.cos((i * Math.PI) / 3) * 0.035,
            -0.161,
          ],
          [0.01, 0.02, 0.003],
          8,
        )
        petal.rotation.z = (-i * Math.PI) / 3
      }
      const scarf = add(
        g,
        new THREE.TorusGeometry(0.065, 0.021, 8, 22),
        silk,
        0,
        1.493,
        0,
      )
      scarf.rotation.x = Math.PI / 2
      scarf.scale.set(1, 1, 0.72)
      const ribbon = cloth(
        g,
        silk,
        [
          [-0.025, 1.49],
          [0.038, 1.49],
          [0.076, 1.09],
          [0.025, 1.02],
          [-0.005, 1.19],
        ],
        0.012,
      )
      ribbon.position.z = 0.163
      cord(
        g,
        [
          [0.02, 1.46, 0.18],
          [0.025, 1.27, 0.188],
          [0.045, 1.09, 0.18],
        ],
        white,
        0.003,
        14,
      )
    }
    head(g, name)
    sword(g, name)
    return g
  }
  const characters = [
    character("Ichigo", -3.2, 6, 1),
    character("Rukia", 7, 1, 0.88),
    character("Byakuya", -6, 9, 1.02),
  ]
  characters.forEach((g, i) => {
    g.rotation.y = [0.1, -0.12, 0.16][i]
  })
  return {
    characters,
    update(time: number) {
      if (!Number.isFinite(time)) return
      characters.forEach((g, i) => {
        g.rotation.y = [0.1, -0.12, 0.16][i] + Math.sin(time * 0.35 + i) * 0.017
        g.position.y = 0.15 + Math.sin(time * 0.9 + i) * 0.002
      })
    },
  }
}
