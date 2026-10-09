import * as THREE from 'three'
import { createBioluminescenceMap } from './BioluminescenceMap.js'

// WebGL adapter of Pelagic's original TSL tissue equations (published 66dff315).
// Keep its anatomical UVs, depth/absorption, canals and luminous cell map.
// Only the shader backend changes; anatomy and constraint simulation are original.
export function createJellyTissue({ membrane = false } = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xb2ddeb,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0,
    specularIntensity: 0.65,
    ior: 1.24,
    transmission: 0,
    envMapIntensity: 0,
    emissive: membrane ? 0x663da8 : 0x4f72d8,
    emissiveIntensity: membrane ? 0.32 : 0.5,
    transparent: true,
    opacity: membrane ? 0.42 : 0.58,
    side: THREE.DoubleSide,
    depthWrite: false,
    vertexColors: !membrane,
  })
  const detailMap = createBioluminescenceMap()
  const opacity = { value: material.opacity }
  material.userData.tissueOpacity = opacity
  material.userData.detailMap = detailMap
  material.customProgramCacheKey = () =>
    `pelagic-tissue-canonical66-webgl-v3-${membrane}`
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTissueDetail = { value: detailMap }
    shader.uniforms.uTissueOpacity = opacity
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec2 vAnatomyUv; varying vec3 vAnatomyNormal;
      ${membrane ? '' : 'attribute float tissueSignal; varying float vTissueSignal;'}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vAnatomyUv=uv; vAnatomyNormal=normalize(mat3(modelMatrix)*normal);
        ${membrane ? '' : 'vTissueSignal=tissueSignal;'}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      uniform sampler2D uTissueDetail; uniform float uTissueOpacity;
      varying vec2 vAnatomyUv; varying vec3 vAnatomyNormal;
      ${membrane ? '' : 'varying float vTissueSignal;'}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float v=clamp(vAnatomyUv.y,0.,1.); vec4 tissueDetail=texture2D(uTissueDetail,vAnatomyUv);
        float canals=pow(cos(vAnatomyUv.x*50.26548+sin(v*1.2)*.3)*.5+.5,7.)*pow(v,.65);
        float mesoglea=max(0.,sin(v*3.14159265));
        float thickness=${membrane ? 'abs(sin(vAnatomyUv.x*3.14159265))*.2+.07' : 'pow(max(0.,1.-v),1.4)*.30+.04+canals*.20*mesoglea'};
        float facing=max(.24,abs(dot(normalize(vNormal),normalize(vViewPosition))));
        float absorption=1.-exp(-thickness/facing*1.7);
        float sheetEdge=${membrane ? 'pow(abs(sin(vAnatomyUv.x*3.14159265)),.25)*.7+.3' : '1.'};
        diffuseColor.a=clamp((absorption*${membrane ? '.38' : '.40'}+.08)*sheetEdge*(uTissueOpacity/.58),.025,.62);
        diffuseColor.rgb=${membrane ? 'mix(vec3(.34,.30,.60),vec3(.65,.72,.87),absorption)' : 'mix(vec3(.18,.39,.67),vec3(.60,.78,.89),absorption)*(1.-canals*.07)'};
        // r175 NodeMaterial multiplies the authored colorNode by vertex color.
        // Apply it after the replacement, rather than losing it in color_fragment.
        #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
          diffuseColor.rgb *= vColor.rgb;
        #endif
      `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor=${membrane ? '.40' : 'mix(.18,.30,absorption)'};`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        // Equivalent of current Pelagic's analytic water envNode. The source
        // approximates single-pass optics with transmission=0; no framebuffer
        // refraction or second world renderer is introduced here.
        vec3 waterNormal=inverseTransformDirection(geometryNormal,viewMatrix);
        vec3 waterView=inverseTransformDirection(geometryViewDir,viewMatrix);
        vec3 waterReflection=normalize(reflect(-waterView,waterNormal));
        vec3 waterKey=normalize(vec3(.32,.94,.12));
        iblIrradiance+=PI*(vec3(.02,.035,.05)+vec3(.48,.61,.65)*pow(max(0.,dot(waterNormal,waterKey)),2.));
        radiance+=vec3(.02,.035,.05)+vec3(.48,.61,.65)*pow(max(0.,dot(waterReflection,waterKey)),mix(18.,2.,material.roughness));
      `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float backlight=max(0.,-dot(normalize(vAnatomyNormal),normalize(vec3(.3,1.,.2))));
        totalEmissiveRadiance=totalEmissiveRadiance*(tissueDetail.r*.65+.35)+vec3(.045,.095,.13)*backlight*thickness;
        ${
          membrane
            ? `totalEmissiveRadiance+=vec3(.12,.20,.50)*tissueDetail.g*.22+vec3(.8,.38,.65)*tissueDetail.b*.85;`
            : `float edge=pow(max(0.,1.-facing),2.); float rim=smoothstep(.82,1.,v)*(edge*.65+.2);
        totalEmissiveRadiance+=vec3(.06,1.2,1.65)*rim+vec3(.06,.45,.8)*tissueDetail.g*.24+vec3(.45,.80,1.)*tissueDetail.b*1.6+vec3(.16,.45,.60)*vTissueSignal;`
        }`,
      )
  }
  material.addEventListener('dispose', () => detailMap.dispose())
  return material
}
