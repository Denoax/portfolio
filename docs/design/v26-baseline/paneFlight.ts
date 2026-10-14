export interface Point2 {
  x: number
  y: number
}
export interface FlightRect {
  x: number
  y: number
  width: number
  height: number
}
export interface TileFlight {
  rect: FlightRect
  anchor: Point2
  opening: boolean
  progress: number
  duration: number
  viewportWidth?: number
  apertureWidth?: number
  fresh?: boolean
}
export interface TilePose extends Point2 {
  alpha: number
  born: boolean
  settled: boolean
  vx: number
  vy: number
}
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => {
  const t = clamp(x)
  return t * t * (3 - 2 * t)
}
export const MENU_OPEN_SECONDS = 0.84
export const MENU_CLOSE_SECONDS = 0.42
export const TILE_BIRTH_SECONDS = 0.18
export function tileSeed(index: number) {
  const fract = (n: number) => n - Math.floor(n)
  return {
    x: fract(Math.sin((index + 1) * 127.1) * 43758.5453),
    y: fract(Math.sin((index + 1) * 311.7) * 22578.1459),
  }
}
// A dispersed cumulative cohort, independent of rows. Seeds never change in flight.
export function paneTileBirth(flight: TileFlight, seed: Point2, fromAlpha = 0) {
  return flight.opening && (flight.fresh !== false || fromAlpha <= 0)
    ? (TILE_BIRTH_SECONDS / flight.duration) * Math.pow(seed.y, 1.35)
    : 0
}
export function paneTileTravel(flight: TileFlight, uv: Point2, seed: Point2, fromAlpha = 0) {
  return flight.opening
    ? flight.fresh === false && fromAlpha > 0
      ? 0.7 + uv.y * 0.2 + seed.x * 0.03
      : 0.43 + uv.y * 0.26 + seed.x * 0.025
    : 1
}
// Cubic Hermite endpoints preserve the sampled velocity on every retarget.
// A separate t²(1-t)² cup bend has zero position AND velocity at both endpoints.
export function paneTilePose(
  flight: TileFlight,
  uv: Point2,
  seed: Point2,
  from: Point2,
  velocity: Point2,
  fromAlpha = flight.opening ? 0 : 1,
  out?: TilePose,
): TilePose {
  const t = clamp(flight.progress)
  const birth = paneTileBirth(flight, seed, fromAlpha)
  const travel = paneTileTravel(flight, uv, seed, fromAlpha)
  const u = clamp((t - birth) / travel)
  const r = flight.rect
  const targetX = flight.opening ? r.x + uv.x * r.width : flight.anchor.x
  const targetY = flight.opening ? r.y + uv.y * r.height : flight.anchor.y
  const u2 = u * u, u3 = u2 * u
  const span = flight.duration * travel
  const start = 2 * u3 - 3 * u2 + 1
  const end = -2 * u3 + 3 * u2
  const momentum = (u3 - 2 * u2 + u) * span
  const bend = 16 * u2 * (1 - u) * (1 - u)
  const fresh = flight.opening && (flight.fresh !== false || fromAlpha <= 0)
  const rawBendX = fresh
    ? (uv.x - 0.5) * Math.min(r.width * 0.58, 260) * (1 - uv.y * 0.3)
    : flight.opening ? 0 : (seed.x - 0.5) * Math.min(90, r.width * 0.2)
  // Keep the quartic Bézier control hull inside the viewport. This bounds
  // fresh fans without a per-frame clamp or a velocity discontinuity.
  const middleX = (from.x + targetX) / 2
  const viewport = flight.viewportWidth ?? 1e6
  const bendX = Math.max(2 - middleX, Math.min(viewport - 2 - middleX, rawBendX * (8 / 3))) * (3 / 8)
  const bendY = fresh
    ? 24 + (1 - Math.abs(uv.x - 0.5) * 2) * (0.3 + uv.y * 0.7) * Math.min(88, r.height * 0.16)
    : flight.opening ? 0 : (seed.y - 0.5) * 38
  const alpha = flight.opening
    ? fromAlpha + (1 - fromAlpha) * smooth((t - birth) * flight.duration / 0.065)
    : fromAlpha * (1 - smooth((u - 0.65) / 0.35))
  const pose = out ?? { x: 0, y: 0, alpha: 0, born: false, settled: false, vx: 0, vy: 0 }
  pose.x = from.x * start + targetX * end + velocity.x * momentum + bendX * bend
  pose.y = from.y * start + targetY * end + velocity.y * momentum + bendY * bend
  pose.alpha = t < birth ? 0 : alpha
  pose.born = t >= birth && (flight.opening || fromAlpha > 0)
  pose.settled = flight.opening && u === 1
  const ds = (6 * u2 - 6 * u) / span, de = -ds
  const dv = 3 * u2 - 4 * u + 1
  const db = 32 * u * (1 - u) * (1 - 2 * u) / span
  pose.vx = t < birth || u === 1 ? 0 : from.x * ds + targetX * de + velocity.x * dv + bendX * db
  pose.vy = t < birth || u === 1 ? 0 : from.y * ds + targetY * de + velocity.y * dv + bendY * db
  return pose
}
export function paneTilePoint(flight: TileFlight, uv: Point2, seed: Point2, from: Point2, velocity: Point2): Point2 {
  const pose = paneTilePose(flight, uv, seed, from, velocity)
  return { x: pose.x, y: pose.y }
}
// Fresh reveal follows the latest possible arrival in each row (birth+travel),
// with a small margin. Retargets keep their already-owned native region.
export function paneNativeFront(progress: number, opening: boolean, from = 0, fresh = true) {
  if (!opening) return 0
  const start = fresh ? 0.695 : 0.74
  const span = fresh ? 0.265 : 0.235
  return from + (1 - from) * clamp((progress - start) / span)
}
export function paneFlightOpacity(progress: number, opening: boolean, from: number) {
  return opening
    ? from + (1 - from) * smooth(progress / 0.22)
    : from * (1 - smooth((progress - 0.65) / 0.35))
}
// Same constants/equations as the CPU sampler; this is original implementation,
// not creator code. Tests compare GPU samples with the CPU retarget contract.
export const paneFlightGLSL = `
float birthPhase(bool opening,bool fresh,float duration,vec2 seed,float alpha){return opening&&(fresh||alpha<=0.)?(.18/duration)*pow(seed.y,1.35):0.;}
float travelPhase(bool opening,bool fresh,vec2 uv,vec2 seed,float alpha){return opening?((fresh||alpha<=0.)?.43+uv.y*.26+seed.x*.025:.7+uv.y*.2+seed.x*.03):1.;}
vec3 tilePose(float t,bool opening,bool fresh,float duration,vec4 r,vec2 anchor,vec2 uv,vec2 seed,vec2 from,vec2 velocity,float alpha,float viewport){
 float birth=birthPhase(opening,fresh,duration,seed,alpha),travel=travelPhase(opening,fresh,uv,seed,alpha),u=clamp((t-birth)/travel,0.,1.);
 float u2=u*u,u3=u2*u,start=2.*u3-3.*u2+1.,end=-2.*u3+3.*u2,momentum=(u3-2.*u2+u)*duration*travel,bend=16.*u2*(1.-u)*(1.-u);
 vec2 target=opening?r.xy+uv*r.zw:anchor;
 vec2 curve=opening?((fresh||alpha<=0.)?vec2((uv.x-.5)*min(r.z*.58,260.)*(1.-uv.y*.3),24.+(1.-abs(uv.x-.5)*2.)*(.3+uv.y*.7)*min(88.,r.w*.16)):vec2(0.)):vec2((seed.x-.5)*min(90.,r.z*.2),(seed.y-.5)*38.);
 float a=opening?mix(alpha,1.,ease((t-birth)*duration/.065)):alpha*(1.-ease((u-.65)/.35));
 float middleX=(from.x+target.x)*.5;curve.x=clamp(curve.x*(8./3.),2.-middleX,viewport-2.-middleX)*(3./8.);
 return vec3(from*start+target*end+velocity*momentum+curve*bend,t<birth?0.:a);
}`
