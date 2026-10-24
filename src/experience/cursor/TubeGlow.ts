import * as THREE from 'three'

// Tube-only linear emission -> separable blur -> output conversion/composite.
// No scene texture, global composer, extra renderer or animation owner.
export class TubeGlow {
  private readonly targets = [0, 1].map(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false })
    target.texture.colorSpace = THREE.NoColorSpace
    target.texture.generateMipmaps = false
    return target
  })
  readonly emission = new THREE.ShaderMaterial({
    name: 'WorldsTubesEmission', vertexColors: true, toneMapped: false,
    transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
    vertexShader: `attribute float aTubeTaper;varying vec3 vGlowPigment;
      void main(){vGlowPigment=color;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*1.4*aTubeTaper,1.);}`,
    // Premultiplied linear color and coverage travel through both blur passes.
    fragmentShader: `varying vec3 vGlowPigment;
      void main(){gl_FragColor=vec4(vGlowPigment,1.);}`,
  })
  readonly blur = new THREE.ShaderMaterial({
    name: 'WorldsTubesBlur', depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uGlow: { value: this.targets[0].texture }, uStep: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D uGlow;uniform vec2 uStep;varying vec2 vUv;
      void main(){vec4 sum=texture2D(uGlow,vUv)*.227027;
        sum+=(texture2D(uGlow,vUv+uStep)+texture2D(uGlow,vUv-uStep))*.1945946;
        sum+=(texture2D(uGlow,vUv+uStep*2.)+texture2D(uGlow,vUv-uStep*2.))*.1216216;
        sum+=(texture2D(uGlow,vUv+uStep*3.)+texture2D(uGlow,vUv-uStep*3.))*.054054;
        sum+=(texture2D(uGlow,vUv+uStep*4.)+texture2D(uGlow,vUv-uStep*4.))*.016216;
        gl_FragColor=sum;}`,
  })
  readonly composite = new THREE.ShaderMaterial({
    name: 'WorldsTubesHalo', transparent: true, premultipliedAlpha: true,
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uGlow: { value: this.targets[0].texture }, uHaloLight: { value: 1 },
      uHaloOpacity: { value: 0 }, uHaloBrightness: { value: 1 } },
    vertexShader: this.blur.vertexShader,
    fragmentShader: `uniform sampler2D uGlow;uniform float uHaloLight,uHaloOpacity,uHaloBrightness;varying vec2 vUv;
      void main(){vec4 halo=texture2D(uGlow,vUv);
        vec3 pigment=halo.rgb/max(halo.a,.0001);
        float alpha=min(.65,halo.a*mix(5.,3.5,uHaloLight))*uHaloOpacity;
        gl_FragColor=vec4(pigment*mix(1.6,.8,uHaloLight)*uHaloBrightness,alpha);
        #include <colorspace_fragment>
        #include <premultiplied_alpha_fragment>
      }`,
  })
  private readonly emissionScene = new THREE.Scene()
  private readonly screenScene = new THREE.Scene()
  private readonly screenGeometry = new THREE.PlaneGeometry(2, 2)
  private readonly screen = new THREE.Mesh(this.screenGeometry, this.blur)
  private readonly camera = new THREE.Camera()
  private readonly buffer = new THREE.Vector2()
  private disposed = false

  constructor(geometry: THREE.BufferGeometry) {
    const emitter = new THREE.Mesh(geometry, this.emission)
    emitter.frustumCulled = this.screen.frustumCulled = false
    this.emissionScene.add(emitter)
    this.screenScene.add(this.screen)
  }

  async prepare(gl: THREE.WebGLRenderer, camera: THREE.Camera) {
    if (this.disposed) return
    try {
      await gl.compileAsync(this.emissionScene, camera)
      for (const material of [this.blur, this.composite]) {
        if (this.disposed) return
        this.screen.material = material
        await gl.compileAsync(this.screenScene, this.camera)
      }
      if (this.disposed) return
      const context = gl.getContext()
      for (const material of [this.emission, this.blur, this.composite]) {
        const program = gl.info.programs?.find(p => p.name === material.name)?.program
        if (!program || !context.getProgramParameter(program, context.LINK_STATUS)) throw new Error(`${material.name} did not link`)
      }
    } finally { this.screen.material = this.blur }
  }

  renderEmission(gl: THREE.WebGLRenderer, camera: THREE.Camera, width: number, height: number) {
    gl.getDrawingBufferSize(this.buffer)
    const scale = Math.min(.5, 1024 / this.buffer.x, 1024 / this.buffer.y)
    const w = Math.max(1, Math.round(this.buffer.x * scale)), h = Math.max(1, Math.round(this.buffer.y * scale))
    for (const target of this.targets) if (target.width !== w || target.height !== h) target.setSize(w, h)
    gl.setScissorTest(false)
    // setRenderTarget owns its physical-pixel viewport. setViewport would apply
    // the canvas DPR again and misalign emission with the sharp body at DPR2.
    gl.setRenderTarget(this.targets[0])
    gl.setClearColor(0, 0); gl.clear(true, false, false)
    gl.render(this.emissionScene, camera)
    this.screen.material = this.blur
    this.blur.uniforms.uGlow.value = this.targets[0].texture
    this.blur.uniforms.uStep.value.set(2.5 / width, 0)
    gl.setRenderTarget(this.targets[1]); gl.render(this.screenScene, this.camera)
    this.blur.uniforms.uGlow.value = this.targets[1].texture
    this.blur.uniforms.uStep.value.set(0, 2.5 / height)
    gl.setRenderTarget(this.targets[0]); gl.render(this.screenScene, this.camera)
  }

  renderComposite(gl: THREE.WebGLRenderer, light: number, opacity: number, brightness: number) {
    this.composite.uniforms.uHaloLight.value = light
    this.composite.uniforms.uHaloOpacity.value = opacity
    this.composite.uniforms.uHaloBrightness.value = brightness
    this.screen.material = this.composite
    gl.render(this.screenScene, this.camera)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.targets.forEach(target => target.dispose())
    this.emission.dispose(); this.blur.dispose(); this.composite.dispose()
    this.screenGeometry.dispose(); this.emissionScene.clear(); this.screenScene.clear()
  }
}
