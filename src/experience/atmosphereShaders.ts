import { sunGLSL } from '../core/ocean'
// Temporary analytic daylight until Paul's exact downloadable sky is supplied.
// This is authored shading, never the Sketchfab thumbnail stretched into a sky.
export const skyGLSL = `
vec3 daylight(vec3 ray){
  float elevation=clamp(ray.y,0.,1.);
  vec3 sky=mix(vec3(.32,.46,.61),vec3(.045,.16,.34),pow(elevation,.35));
  float sun=pow(max(0.,dot(ray,normalize(${sunGLSL}))),700.);
  float haze=pow(max(0.,dot(ray,normalize(${sunGLSL}))),12.);
  return sky+vec3(1.,.78,.48)*sun*3.+vec3(.08,.062,.035)*haze;
}`
export const screenVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`
export const worldRayGLSL = `uniform mat4 uInverseProjection,uCameraWorld;varying vec2 vUv;
vec3 worldRay(){vec4 v=uInverseProjection*vec4(vUv*2.-1.,1.,1.);return normalize(mat3(uCameraWorld)*v.xyz);}`
