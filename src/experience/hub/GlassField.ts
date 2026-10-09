import * as THREE from 'three'
// One authored SDF layer. Glass study's quiet moving square cluster is the
// reference; no transmission capture, branded asset or external texture.
export class GlassField {
  readonly material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uLight: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uColor: { value: new THREE.Color('#89cada') },
      uOpacity: { value: 1 },
    },
    vertexShader:
      'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.99,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float uTime,uAspect,uOpacity,uLight;uniform vec3 uColor;
  float box(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}
  void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);float t=uTime*.2856;vec2 center=vec2(.36*uAspect+sin(t)*.045,cos(t*.7)*.1);float rotation=sin(t*.5)*.13;mat2 turn=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation));vec2 local=turn*(p-center);float light=0.;
  for(int i=0;i<6;i++){float col=mod(float(i),3.),row=floor(float(i)/3.);vec2 q=local-vec2((col-1.)*.175,(row-.5)*.18);float d=box(q,vec2(.083),.024);float aa=max(fwidth(d),.001);float fill=1.-smoothstep(-aa,aa,d);float edge=exp(-abs(d)*160.);light+=fill*(.018+.034*smoothstep(.08,-.08,q.y)) + edge*.085;}
  float textMask=smoothstep(.32,.53,vUv.x);if(uAspect<.95)textMask=1.-smoothstep(.38,.43,1.-vUv.y);
  gl_FragColor=vec4(mix(uColor*light,uColor*.4, uLight),textMask*uOpacity*mix(1.,light*1.7,uLight));
  #include <colorspace_fragment>
  }`,
  })
  readonly geometry = new THREE.PlaneGeometry(2, 2)
  readonly mesh = new THREE.Mesh(this.geometry, this.material)
  constructor() {
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -10
  }
  dispose() {
    this.material.dispose()
    this.geometry.dispose()
  }
}
