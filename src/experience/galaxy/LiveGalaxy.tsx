import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { narrative, smoothstep } from '../../core/narrative'
import { descentPhase } from '../../core/descent'
import type { QualityProfile } from '../../core/quality'
import { createGalaxyGeometry, createStarGeometry } from './createGalaxy'

const noise = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.3,4.1);a*=.5;}return v;}`
const planeVertex = `varying vec2 vUv;varying float vDepth;varying vec3 vView; void main(){vUv=uv;vec4 v=modelViewMatrix*vec4(position,1.);vDepth=-v.z;vView=v.xyz;gl_Position=projectionMatrix*v;}`
const planeFragment = `${noise}
uniform float uTime,uPresence,uDust,uApproach; varying vec2 vUv;varying float vDepth;varying vec3 vView;
void main(){vec2 p=(vUv-.5)*24.;float r=length(p);float angle=atan(p.y,p.x);float n=fbm(p*.8+uTime*.012);
float spiral=cos(angle*4.-log(r+.75)*10.6+n*3.8);float arms=pow(max(0.,spiral),2.5);
float edge=1.-smoothstep(6.,11.8,r);float core=exp(-r*r*.5);float body=exp(-r*.3)*(.13+arms*.6)*( .35+fbm(p*3.2));
vec3 cool=vec3(.18,.32,.57);vec3 warm=vec3(1.4,.78,.29);vec3 color=mix(cool,warm,exp(-r*.32));
float a=edge*(body*1.5+core*.75)*uPresence;
if(uDust>.5){float lane=pow(max(0.,cos(angle*4.-log(r+.75)*10.6+n*2.+.75)),4.);a=edge*lane*smoothstep(.8,3.,r)*(.2+.7*fbm(p*1.7))*uPresence*.72;color=vec3(.012,.011,.016);}
// Clear a narrow line of sight through nearby dust as the lens enters the
// core, retaining the surrounding arms. Overview shading remains unchanged.
float channel=mix(1.,smoothstep(.05,.17,length(vView.xy)/max(.1,-vView.z)),uApproach);
gl_FragColor=vec4(color*(uDust>.5?1.:1.35),a*smoothstep(.12,1.8,vDepth)*channel);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
const pointVertex = `attribute float aSeed,aSize,aEnergy; uniform float uTime,uHeight,uMaxPoint;varying float vEnergy,vSeed,vDepth,vAngle;
void main(){vec3 p=position;float r=length(p.xz);float angle=uTime*.005/(1.+r*.15);mat2 spin=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));p.xz=spin*p.xz;
p.y+=sin(aSeed*20.+uTime*.3)*.055;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
gl_PointSize=clamp(aSize*uHeight*.019/max(1.,-view.z),.55,uMaxPoint);vEnergy=aEnergy;vSeed=aSeed;vDepth=-view.z;vAngle=length(view.xy)/max(.1,-view.z);}`
const pointFragment = `uniform float uTime,uPresence,uApproach;varying float vEnergy,vSeed,vDepth,vAngle;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
float disc=exp(-r*r*5.);float flicker=.84+.16*sin(uTime*.8+vSeed*70.);vec3 warm=vec3(1.5,.93,.44),cool=vec3(.35,.55,.94);
vec3 color=mix(cool,warm,smoothstep(.3,.9,vEnergy));float intensity=(.15+vEnergy*.65)*flicker;
gl_FragColor=vec4(color*1.8,disc*intensity*uPresence*smoothstep(.15,2.5,vDepth)*mix(1.,smoothstep(.05,.17,vAngle)*.72,uApproach));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
export function LiveGalaxy({ quality }: { quality: QualityProfile }) {
  const { gl, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const resources = useMemo(() => {
    const geometry = createGalaxyGeometry(quality.particles)
    for (const key of Object.keys(geometry.attributes))
      if (!['position', 'aSeed', 'aSize', 'aEnergy'].includes(key))
        geometry.deleteAttribute(key)
    const max = (
      gl
        .getContext()
        .getParameter(gl.getContext().ALIASED_POINT_SIZE_RANGE) as Float32Array
    )[1]
    const points = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: 900 },
        uMaxPoint: { value: Math.min(max, 24) },
        uPresence: { value: 1 },
        uApproach: { value: 0 },
      },
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const layers = [0, 1, 1, 0].map(
      (dust, index) =>
        new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: index * 8 },
            uPresence: { value: 1 },
            uApproach: { value: 0 },
            uDust: { value: dust },
          },
          vertexShader: planeVertex,
          fragmentShader: planeFragment,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: dust ? THREE.NormalBlending : THREE.AdditiveBlending,
        }),
    )
    const plane = new THREE.PlaneGeometry(24, 24)
    return { geometry, points, layers, plane, maxPoint: max }
  }, [quality.particles, gl])
  useEffect(
    () => () => {
      resources.geometry.dispose()
      resources.points.dispose()
      resources.plane.dispose()
      resources.layers.forEach((m) => m.dispose())
    },
    [resources],
  )
  useFrame(() => {
    const s = descentPhase(Math.min(1, narrative.state))
    const presence = narrative.frame.galaxy
    if (!group.current) return
    group.current.visible = presence > 0.002
    const compact = size.width < 720
    group.current.position.set(
      compact ? 0.7 : 4,
      compact && size.height < 700 ? 5.2 : 3.8,
      0,
    )
    group.current.rotation.z = compact ? -0.28 : -0.24
    group.current.rotation.y =
      -0.35 +
      (narrative.reducedMotion ? 0 : Math.sin(narrative.elapsed * 0.04) * 0.045)
    const time = narrative.reducedMotion ? 12 : narrative.elapsed
    resources.points.uniforms.uTime.value = time
    resources.points.uniforms.uHeight.value = size.height * gl.getPixelRatio()
    resources.points.uniforms.uApproach.value = smoothstep((s - 0.18) / 0.07)
    resources.points.uniforms.uMaxPoint.value =
      Math.min(24, resources.maxPoint) *
      (1 - 0.75 * smoothstep((s - 0.12) / 0.1))
    resources.points.uniforms.uPresence.value = presence
    resources.layers.forEach((m, i) => {
      m.uniforms.uApproach.value = smoothstep((s - 0.18) / 0.07)
      m.uniforms.uTime.value = time + i * 9
      m.uniforms.uPresence.value =
        presence *
        (i === 3 ? 0.32 : 1) *
        (1 - smoothstep((s - 0.12) / 0.1) * 0.45) *
        // These distant dust sheets have no thickness. Retire them before
        // their triangles intersect the lens; spatial points and the finite
        // emissive volume carry the close shot without changing the camera.
        (1 - smoothstep((s - 0.18) / 0.045))
    })
  })
  return (
    <group ref={group} scale={0.72}>
      <points
        geometry={resources.geometry}
        material={resources.points}
        renderOrder={2}
      />
      {resources.layers.map((material, i) => (
        <mesh
          key={i}
          geometry={resources.plane}
          material={material}
          rotation-x={-Math.PI / 2}
          position-y={i * 0.18 - 0.14}
          renderOrder={i + 3}
        />
      ))}
    </group>
  )
}
export function FarStars({ quality }: { quality: QualityProfile }) {
  const points = useRef<THREE.Points>(null)
  const geometry = useMemo(
    () => createStarGeometry(quality.stars),
    [quality.stars],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => {
    if (points.current) {
      points.current.visible =
        narrative.frame.sky < 0.99 &&
        narrative.frame.clouds < 0.99 &&
        narrative.frame.submerged < 0.001
      ;(points.current.material as THREE.PointsMaterial).opacity =
        0.6 * (1 - narrative.frame.sky) * (1 - narrative.frame.clouds)
      points.current.rotation.y = narrative.reducedMotion
        ? 0
        : narrative.elapsed * 0.0015
    }
  })
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.07}
        color="#b7c6e0"
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </points>
  )
}
