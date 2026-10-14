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
  tileCount?: number
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
// Cubic cohort growth starts with a few cells without delaying the first draw.
// Seeds and the final birth deadline remain stable across the existing pool.
export function paneTileBirth(flight: TileFlight, seed: Point2, fromAlpha = 0) {
  return flight.opening && (flight.fresh !== false || fromAlpha <= 0)
    ? (TILE_BIRTH_SECONDS / flight.duration) * Math.cbrt(seed.y)
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
  const distance = Math.hypot(targetX - from.x, targetY - from.y)
  const speed = Math.hypot(velocity.x, velocity.y)
  // Preserve the reversal derivative, then brake within 45ms and a small
  // fraction of the remaining path instead of carrying a fresh outward fan.
  const brake = Math.min(0.045, Math.max(0.005, distance * 0.15 / Math.max(1, speed)))
  const decay = Math.exp(-u * span / brake)
  const momentum = flight.opening
    ? (u3 - 2 * u2 + u) * span
    : brake * (1 - decay) * (1 - u) * (1 - u)
  const bend = 16 * u2 * (1 - u) * (1 - u)
  const fresh = flight.opening && (flight.fresh !== false || fromAlpha <= 0)
  const rawBendX = fresh
    ? (uv.x - 0.5) * Math.min(r.width * 0.58, 260) * (1 - uv.y * 0.3) * 0.65
    : 0
  // Keep the quartic Bézier control hull inside the viewport. This bounds
  // fresh fans without a per-frame clamp or a velocity discontinuity.
  const middleX = (from.x + targetX) / 2
  const viewport = flight.viewportWidth ?? 1e6
  const bendX = flight.opening
    ? Math.max(2 - middleX, Math.min(viewport - 2 - middleX, rawBendX * (8 / 3))) * (3 / 8)
    : 0
  const bendY = fresh
    ? (24 + (1 - Math.abs(uv.x - 0.5) * 2) * (0.3 + uv.y * 0.7) * Math.min(88, r.height * 0.16)) * 0.65
    : 0
  // Compensate the projected area before raising material coverage: many
  // compressed low-alpha cells must not become an opaque source sheet.
  const coverage = end * end * (0.15 + 0.85 * end)
  const count = flight.tileCount ?? Math.ceil(r.width / 4) * Math.ceil(r.height / 4)
  const pilot = seed.y < 16 / count ? 0.10 * smooth((t - birth) * flight.duration / 0.02) : 0
  const reveal = fresh ? 1 - (1 - coverage) * (1 - pilot) : coverage
  const alpha = flight.opening
    ? fromAlpha + (1 - fromAlpha) * reveal
    : fromAlpha * (1 - u) * (1 - u) * start * start
  const pose = out ?? { x: 0, y: 0, alpha: 0, born: false, settled: false, vx: 0, vy: 0 }
  pose.x = from.x * start + targetX * end + velocity.x * momentum + bendX * bend
  pose.y = from.y * start + targetY * end + velocity.y * momentum + bendY * bend
  pose.alpha = t < birth ? 0 : alpha
  pose.born = t >= birth && (flight.opening || fromAlpha > 0)
  pose.settled = flight.opening && u === 1
  const ds = (6 * u2 - 6 * u) / span, de = -ds
  const dv = flight.opening
    ? 3 * u2 - 4 * u + 1
    : decay * (1 - u) * (1 - u) - 2 * brake * (1 - decay) * (1 - u) / span
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
    : from * (1 - clamp(progress)) ** 2 * (1 - smooth(progress)) ** 2
}
// Same constants/equations as the CPU sampler; this is original implementation,
// not creator code. Tests compare GPU samples with the CPU retarget contract.
export const paneFlightGLSL = `
float birthPhase(bool opening,bool fresh,float duration,vec2 seed,float alpha){return opening&&(fresh||alpha<=0.)?(.18/duration)*pow(seed.y,1./3.):0.;}
float travelPhase(bool opening,bool fresh,vec2 uv,vec2 seed,float alpha){return opening?((fresh||alpha<=0.)?.43+uv.y*.26+seed.x*.025:.7+uv.y*.2+seed.x*.03):1.;}
vec3 tilePose(float t,bool opening,bool fresh,float duration,vec4 r,vec2 anchor,vec2 uv,vec2 seed,vec2 from,vec2 velocity,float alpha,float viewport,float count){
 float birth=birthPhase(opening,fresh,duration,seed,alpha),travel=travelPhase(opening,fresh,uv,seed,alpha),u=clamp((t-birth)/travel,0.,1.);
 vec2 target=opening?r.xy+uv*r.zw:anchor;
 float u2=u*u,u3=u2*u,span=duration*travel,start=2.*u3-3.*u2+1.,end=-2.*u3+3.*u2,brake=min(.045,max(.005,length(target-from)*.15/max(1.,length(velocity)))),decay=exp(-u*span/brake);
 float momentum=opening?(u3-2.*u2+u)*span:brake*(1.-decay)*(1.-u)*(1.-u),bend=16.*u2*(1.-u)*(1.-u);
 vec2 curve=opening&&(fresh||alpha<=0.)?vec2((uv.x-.5)*min(r.z*.58,260.)*(1.-uv.y*.3),24.+(1.-abs(uv.x-.5)*2.)*(.3+uv.y*.7)*min(88.,r.w*.16))*.65:vec2(0.);
 float coverage=end*end*(.15+.85*end),pilot=seed.y<16./count?.10*ease((t-birth)*duration/.02):0.;
 float reveal=fresh||alpha<=0.?1.-(1.-coverage)*(1.-pilot):coverage;
 float a=opening?mix(alpha,1.,reveal):alpha*(1.-u)*(1.-u)*start*start;
 float middleX=(from.x+target.x)*.5;curve.x=opening?clamp(curve.x*(8./3.),2.-middleX,viewport-2.-middleX)*(3./8.):0.;
 return vec3(from*start+target*end+velocity*momentum+curve*bend,t<birth?0.:a);
}`
