import * as THREE from "three"

export const CLOISTER_INK = "#b8b8b8"

type OutlinedMesh = {
  source: THREE.Mesh
  hull: THREE.Mesh
  originalMaterial: THREE.Material | THREE.Material[]
  originalGeometry: THREE.BufferGeometry
  originalFrustumCulled: boolean
  generatedGeometry?: THREE.BufferGeometry
}

/**
 * Black depth-writing surfaces with a thin, back-face contour.
 * The hull follows the same skeleton and morph weights as the visible mesh.
 * It owns only the new materials and any normals it had to generate.
 */
export function applyCloisterSilhouette(root: THREE.Object3D) {
  const viewport = { value: new THREE.Vector2(1280, 720) }
  const lineWidth = { value: 1.15 }
  const worldLimit = { value: 0.009 }
  const fill = new THREE.MeshBasicMaterial({
    name: "Cloister silhouette / black interior",
    color: 0x000000,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    fog: false,
    toneMapped: false,
  })
  const ink = new THREE.MeshBasicMaterial({
    name: "Cloister silhouette / pale contour",
    color: CLOISTER_INK,
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: true,
    fog: true,
    toneMapped: false,
  })

  ink.onBeforeCompile = (shader) => {
    shader.uniforms.cloisterViewport = viewport
    shader.uniforms.cloisterLineWidth = lineWidth
    shader.uniforms.cloisterWorldLimit = worldLimit
    shader.vertexShader = `
      uniform vec2 cloisterViewport;
      uniform float cloisterLineWidth;
      uniform float cloisterWorldLimit;
    ` + shader.vertexShader.replace(
      "#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )",
      // Basic materials normally skip normals on unskinned meshes. Both
      // branches need the same morph-normal / skin-normal calculation here.
      "#if 1",
    ).replace(
      "#include <project_vertex>",
      `
        #include <project_vertex>
        vec3 contourNormal = normalize(transformedNormal);
        #ifdef FLIP_SIDED
          contourNormal = -contourNormal;
        #endif
        vec4 projectedNormal = projectionMatrix * vec4(contourNormal, 0.0);
        vec2 contourDirection = projectedNormal.xy * gl_Position.w
          - gl_Position.xy * projectedNormal.w;
        vec2 safeViewport = max(cloisterViewport, vec2(1.0));
        contourDirection *= safeViewport;
        float directionLength = length(contourDirection);
        if (directionLength > 0.000001 && gl_Position.w > 0.0) {
          // Screen-space width prevents a close-up from becoming a white band.
          // The physical cap lets the figure recede with the aerial drawing.
          float projectedWidth = cloisterWorldLimit * projectionMatrix[1][1]
            * safeViewport.y / (2.0 * gl_Position.w);
          float width = min(cloisterLineWidth, projectedWidth);
          gl_Position.xy += contourDirection / directionLength
            * (2.0 * width / safeViewport) * gl_Position.w;
        }
      `,
    )
  }
  ink.customProgramCacheKey = () => "cloister-skinned-contour-v1"

  const sources: THREE.Mesh[] = []
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) sources.push(object as THREE.Mesh)
  })
  const meshes: OutlinedMesh[] = []
  for (const source of sources) {
    const originalGeometry = source.geometry
    let generatedGeometry: THREE.BufferGeometry | undefined
    if (!source.geometry.getAttribute("normal")) {
      generatedGeometry = source.geometry.clone()
      generatedGeometry.computeVertexNormals()
      source.geometry = generatedGeometry
    }
    const skinned = source as THREE.SkinnedMesh
    let hull: THREE.Mesh
    if (skinned.isSkinnedMesh) {
      const skinHull = new THREE.SkinnedMesh(source.geometry, ink)
      skinHull.bindMode = skinned.bindMode
      skinHull.bindMatrix.copy(skinned.bindMatrix)
      skinHull.bindMatrixInverse.copy(skinned.bindMatrixInverse)
      skinHull.skeleton = skinned.skeleton
      hull = skinHull
    } else {
      hull = new THREE.Mesh(source.geometry, ink)
    }
    hull.name = source.name + " / contour"
    hull.frustumCulled = false
    hull.castShadow = hull.receiveShadow = false
    hull.layers.mask = source.layers.mask
    // All opaque black surfaces write depth before their contour pass.
    hull.renderOrder = source.renderOrder + 1
    hull.morphTargetInfluences = source.morphTargetInfluences
    hull.morphTargetDictionary = source.morphTargetDictionary
    hull.onBeforeRender = (renderer) => {
      renderer.getSize(viewport.value)
      hull.morphTargetInfluences = source.morphTargetInfluences
      if (skinned.isSkinnedMesh) {
        const skinHull = hull as THREE.SkinnedMesh
        skinHull.skeleton = skinned.skeleton
        skinHull.bindMatrix.copy(skinned.bindMatrix)
        skinHull.bindMatrixInverse.copy(skinned.bindMatrixInverse)
      }
    }
    meshes.push({
      source,
      hull,
      originalMaterial: source.material,
      originalGeometry,
      originalFrustumCulled: source.frustumCulled,
      generatedGeometry,
    })
    source.material = fill
    source.frustumCulled = false
    source.add(hull)
  }

  let disposed = false
  return {
    dispose() {
      if (disposed) return
      disposed = true
      for (const item of meshes) {
        item.hull.removeFromParent()
        item.source.material = item.originalMaterial
        item.source.geometry = item.originalGeometry
        item.source.frustumCulled = item.originalFrustumCulled
        item.generatedGeometry?.dispose()
      }
      fill.dispose()
      ink.dispose()
    },
  }
}
