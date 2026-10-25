const fract = (x: number) => x - Math.floor(x)
const hash = (x: number, y: number) => {
  let a = fract(x * 0.1031),
    b = fract(y * 0.1031),
    c = fract(x * 0.1031)
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += d
  b += d
  c += d
  return fract((a + b) * c)
}
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = fract(x),
    fy = fract(y)
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy),
    b = hash(ix + 1, iy),
    c = hash(ix, iy + 1),
    d = hash(ix + 1, iy + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export function contourField(x: number, y: number, t = 0) {
  // Two independent currents deform the field rather than sliding a fixed texture.
  const swell = 0.95 + Math.sin(t * 0.22) * 0.14
  const wx = noise(x * 0.55 + t * 0.1, y * 0.55 - t * 0.07)
  const wy = noise(x * 0.55 - t * 0.08 + 7.3, y * 0.55 + t * 0.09 + 3.1)
  const px = x + (wx - 0.5) * 1.8 * swell
  const py = y + (wy - 0.5) * 1.8 * swell
  const a = noise(px + t * 0.045, py - t * 0.025)
  const b = noise(px * 2.03 - t * 0.035, py * 2.03 + t * 0.04)
  return a * 0.76 + b * 0.24
}
/** Static marching-squares fallback shares the same original contour vocabulary. */
export function contourPath() {
  const cols = 80,
    rows = 50,
    step = 20
  const grid = Array.from({ length: rows + 1 }, (_, y) =>
    Array.from({ length: cols + 1 }, (_, x) => contourField(x / 18, y / 18)),
  )
  let path = ""
  for (let level = 0.15; level < 0.9; level += 0.12)
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const values = [
          grid[y][x],
          grid[y][x + 1],
          grid[y + 1][x + 1],
          grid[y + 1][x],
        ]
        const coords = [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ]
        const hits: number[][] = []
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4,
            a = values[i],
            b = values[j]
          if (a < level === b < level) continue
          const t = (level - a) / (b - a)
          hits.push([
            (coords[i][0] + (coords[j][0] - coords[i][0]) * t) * step,
            (coords[i][1] + (coords[j][1] - coords[i][1]) * t) * step,
          ])
        }
        for (let i = 0; i + 1 < hits.length; i += 2)
          path += `M${hits[i][0].toFixed(1)} ${hits[i][1].toFixed(1)}L${hits[i + 1][0].toFixed(1)} ${hits[i + 1][1].toFixed(1)}`
      }
  return path
}
export function contourCharacters() {
  let result = ""
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 140; x++) {
      const v = fract(contourField(x / 27, y / 16) * 8)
      result += v < 0.065 ? ":" : v > 0.94 ? "." : " "
    }
    result += "\n"
  }
  return result
}
export const contourVertex = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`
export const contourFragment = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform vec2 resolution;
uniform vec3 ink;
uniform float time;
float hash(vec2 p){vec3 q=fract(vec3(p.x,p.y,p.x)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}
void main(){
vec2 p=vec2(uv.x*resolution.x/resolution.y,uv.y)*3.2;
float swell=.95+sin(time*.22)*.14;
vec2 warp=vec2(noise(p*.55+vec2(time*.1,-time*.07)),
               noise(p*.55+vec2(-time*.08+7.3,time*.09+3.1)));
vec2 q=p+(warp-.5)*1.8*swell;
float n=noise(q+vec2(time*.045,-time*.025))*.76
       +noise(q*2.03+vec2(-time*.035,time*.04))*.24;
float band=n*8.;float d=abs(fract(band+.5)-.5);
float aa=max(fwidth(band),.0005);
float line=1.-smoothstep(aa*.25,aa*1.35,d);
color=vec4(ink,line*.5);
}`
