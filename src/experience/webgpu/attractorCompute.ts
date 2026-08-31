import * as THREE from 'three'

const WORKGROUP_SIZE = 64
const COMPUTE_PARTICLE_LIMIT = 32768

export async function applyWebGPUHistoryDynamics(geometry: THREE.BufferGeometry) {
  if (!navigator.gpu) return false

  const history = geometry.getAttribute('aHistory') as THREE.BufferAttribute | undefined
  if (!history) return false
  const count = Math.min(history.count, COMPUTE_PARTICLE_LIMIT)
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) return false

  const device = await adapter.requestDevice()
  const stride = 8
  const initial = new Float32Array(count * stride)
  for (let index = 0; index < count; index += 1) {
    const offset = index * stride
    const x = history.getX(index)
    const y = history.getY(index)
    const z = history.getZ(index)
    const anchorX = index % 3 === 0 ? -5.5 : index % 3 === 1 ? 0.25 : 5.45
    const anchorY = index % 3 === 0 ? -1.2 : index % 3 === 1 ? 1.25 : -0.45
    const dx = x - anchorX
    const dy = y - anchorY
    initial[offset] = x
    initial[offset + 1] = y
    initial[offset + 2] = z
    initial[offset + 3] = 1
    initial[offset + 4] = -dy * 0.0018
    initial[offset + 5] = dx * 0.0018
    initial[offset + 6] = 0
    initial[offset + 7] = 0
  }

  const byteLength = initial.byteLength
  const particleBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  })
  new Float32Array(particleBuffer.getMappedRange()).set(initial)
  particleBuffer.unmap()

  const readbackBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  const module = device.createShaderModule({
    label: 'Mani career attractor compute',
    code: `
      struct Particle {
        position: vec4f,
        velocity: vec4f,
      }

      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

      @compute @workgroup_size(${WORKGROUP_SIZE})
      fn main(@builtin(global_invocation_id) id: vec3u) {
        let index = id.x;
        if (index >= ${count}u) { return; }

        var particle = particles[index];
        let attractors = array<vec3f, 3>(
          vec3f(-5.5, -1.2, 0.0),
          vec3f(0.25, 1.25, 0.0),
          vec3f(5.45, -0.45, 0.0)
        );
        let attractor = attractors[index % 3u];
        let offset = attractor - particle.position.xyz;
        let distanceSquared = max(dot(offset, offset), 0.18);
        let gravity = normalize(offset) * (0.00042 / distanceSquared);
        let spin = vec3f(-offset.y, offset.x, 0.0) * (0.000018 / sqrt(distanceSquared));
        var velocity = (particle.velocity.xyz + gravity + spin) * 0.997;
        let speed = length(velocity);
        if (speed > 0.018) { velocity = normalize(velocity) * 0.018; }
        particle.velocity = vec4f(velocity, 0.0);
        particle.position = vec4f(particle.position.xyz + velocity, 1.0);
        particles[index] = particle;
      }
    `,
  })
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: particleBuffer } }],
  })
  const encoder = device.createCommandEncoder({ label: 'Career orbit prewarm' })
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(count / WORKGROUP_SIZE))
    pass.end()
  }
  encoder.copyBufferToBuffer(particleBuffer, 0, readbackBuffer, 0, byteLength)
  device.queue.submit([encoder.finish()])
  await readbackBuffer.mapAsync(GPUMapMode.READ)
  const evolved = new Float32Array(readbackBuffer.getMappedRange())
  for (let index = 0; index < count; index += 1) {
    const offset = index * stride
    history.setXYZ(index, evolved[offset], evolved[offset + 1], evolved[offset + 2])
  }
  history.needsUpdate = true
  readbackBuffer.unmap()
  particleBuffer.destroy()
  readbackBuffer.destroy()
  device.destroy()
  return true
}
