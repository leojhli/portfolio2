import * as THREE from "three"

export function createSpiritAtmosphere(scene: THREE.Scene) {
  const clock = { value: 0 }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(145, 32, 16),
    new THREE.ShaderMaterial({
      name: "Moonlit cloud sky",
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        skyTime: clock,
        zenith: { value: new THREE.Color("#070d24") },
        horizon: { value: new THREE.Color("#66728c") },
        cloudTint: { value: new THREE.Color("#a1acc2") },
      },
      vertexShader: `varying vec3 skyDirection;
      void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float skyTime;uniform vec3 zenith,horizon,cloudTint;varying vec3 skyDirection;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec3 d=normalize(skyDirection);float h=max(0.,d.y);vec3 col=mix(horizon,zenith,smoothstep(0.,.65,h));
      vec2 p=d.xz/(.25+h)*3.+vec2(skyTime*.009,skyTime*.002);float cloud=noise(p)*.6+noise(p*2.03)*.28+noise(p*4.1)*.12;
      float bands=smoothstep(.50,.78,cloud)*smoothstep(-.01,.07,d.y)*(1.-smoothstep(.28,.7,d.y));
      col=mix(col,cloudTint,bands*.42);gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    }),
  )
  sky.name = "Atmospheric sky"
  sky.renderOrder = -100
  sky.raycast = () => {}
  scene.add(sky)
  const pixels = new Uint8Array(32 * 32 * 4)
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5),
        i = (y * 32 + x) * 4
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255
      pixels[i + 3] = Math.round(Math.pow(Math.max(0, 1 - r), 2.5) * 180)
    }
  const glowMap = new THREE.DataTexture(pixels, 32, 32)
  glowMap.magFilter = THREE.LinearFilter
  glowMap.minFilter = THREE.LinearFilter
  glowMap.needsUpdate = true
  const lamps: number[] = []
  for (const x of [-4.5, 4.5, -17, 17])
    for (const z of [-3, 3, 12]) lamps.push(x, 1.85, z)
  const glows = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(lamps, 3),
    ),
    new THREE.PointsMaterial({
      color: "#ffcf88",
      size: 1.4,
      map: glowMap,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  )
  glows.name = "Lantern halos"
  glows.raycast = () => {}
  scene.add(glows)
  const positions = new Float32Array(90 * 3),
    seeds = new Float32Array(90 * 3)
  for (let i = 0; i < 90; i++) {
    seeds[i * 3] = Math.sin(i * 38.3) * 24
    seeds[i * 3 + 1] = 0.6 + (i % 9) * 0.48
    seeds[i * 3 + 2] = Math.cos(i * 73.7) * 24
  }
  const fireflies = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    ),
    new THREE.PointsMaterial({
      color: "#b4e5ff",
      size: 0.13,
      map: glowMap,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  )
  fireflies.name = "Reishi motes"
  fireflies.raycast = () => {}
  scene.add(fireflies)
  return {
    textures: [glowMap],
    update(time: number) {
      clock.value = time
      for (let i = 0; i < 90; i++) {
        positions[i * 3] = seeds[i * 3] + Math.sin(time * 0.15 + i) * 0.7
        positions[i * 3 + 1] =
          seeds[i * 3 + 1] + Math.sin(time * 0.35 + i * 2) * 0.25
        positions[i * 3 + 2] =
          seeds[i * 3 + 2] + Math.cos(time * 0.18 + i) * 0.7
      }
      fireflies.geometry.attributes.position.needsUpdate = true
    },
  }
}
