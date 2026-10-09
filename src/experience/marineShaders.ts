// Shared original Pelagic background shading. The full-screen descent adapter
// samples its world-plane UVs before that original opaque plane enters the view.
export const marineColorGLSL = `vec3 marineColor(vec2 p,float time,float depth){
  float beam=exp(-pow((p.x-.58-(1.-p.y)*.22)*8.,2.))*pow(p.y,2.);
  float ripples=.84+.16*sin(p.x*80.+p.y*25.+time*.23)*sin(p.x*39.-time*.14);
  vec3 color=vec3(.002,.007,.016)+vec3(.003,.027,.045)*beam*ripples;
  color+=vec3(.004,.011,.018)*exp(-vec3(.38,.12,.07)*depth);
  return color;
}`
export const MARINE_PLANE_SIZE = [100, 90] as const
export const MARINE_PLANE_Z = -16
