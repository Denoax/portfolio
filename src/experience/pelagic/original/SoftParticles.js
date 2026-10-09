import * as THREE from 'three';

// Backend adapter for Pelagic's original camera-facing particle discs.
// The host owns time and rendering; there is no private renderer or RAF.
export function createSoftParticles(source, options, drift = 0.06) {
  const plane = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry().copy(plane);
  plane.dispose();
  const centers = source.getAttribute('position');
  geometry.setAttribute('particleCenter', new THREE.InstancedBufferAttribute(centers.array, 3));
  geometry.instanceCount = centers.count;
  const seeds = Float32Array.from({ length: centers.count }, (_, i) => i * 2.399963);
  geometry.setAttribute('particleSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const alpha = source.getAttribute('particleAlpha');
  geometry.setAttribute('particleAlpha', new THREE.InstancedBufferAttribute(alpha ? alpha.array : new Float32Array(centers.count).fill(1), 1));
  const colors = source.getAttribute('color');
  geometry.setAttribute('particleTint', new THREE.InstancedBufferAttribute(colors && options.vertexColors ? colors.array : new Float32Array(centers.count * 3).fill(1), 3));
  source.dispose();
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: options.size }, uOpacity: { value: options.opacity ?? 1 }, uDrift: { value: drift }, uColor: { value: new THREE.Color(options.color ?? 0xffffff) } },
    transparent: true, depthWrite: false, blending: options.blending ?? THREE.NormalBlending,
    vertexShader: `attribute vec3 particleCenter; attribute float particleSeed; attribute float particleAlpha; attribute vec3 particleTint;
      uniform float uTime, uSize, uDrift; varying float vAlpha; varying vec3 vTint; varying vec2 vUv;
      void main() { float t=uTime*.28; vec3 drift=vec3(sin(t+particleSeed),sin(t*.71+particleSeed*1.31),cos(t*.83+particleSeed*.79))*uDrift;
        vec4 center=modelViewMatrix*vec4(particleCenter+drift,1.); float scale=length(modelMatrix[0].xyz);
        center.xy+=position.xy*uSize*2.6*scale*(1.+sin(particleSeed)*.22); gl_Position=projectionMatrix*center;
        vUv=uv; vAlpha=particleAlpha*(.88+.12*sin(t*1.2+particleSeed)); vTint=particleTint; }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying float vAlpha; varying vec3 vTint; varying vec2 vUv;
      void main() { float a=pow(1.-smoothstep(.12,1.,length(vUv-.5)*2.),1.4)*uOpacity*vAlpha;
        if(a<.003)discard; gl_FragColor=vec4(uColor*vTint,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  material.size = options.size;
  material.opacity = options.opacity ?? 1;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'soft-drifting-particles'; mesh.frustumCulled = false;
  mesh.onBeforeRender = () => { material.uniforms.uSize.value = material.size; material.uniforms.uOpacity.value = material.opacity; };
  return mesh;
}
