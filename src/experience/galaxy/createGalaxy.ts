import * as THREE from 'three'

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(random: () => number) {
  const a = Math.max(random(), 0.0001)
  const b = random()
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(Math.PI * 2 * b)
}

export function createGalaxyGeometry(count: number) {
  const random = mulberry32(26091999)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const energies = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const population = random()
    let x = 0
    let y = 0
    let z = 0
    let energy = 0.15

    if (population < 0.12) {
      const radius = Math.pow(random(), 2.4) * 2.2
      const theta = random() * Math.PI * 2
      x = Math.cos(theta) * radius * 1.25
      z = Math.sin(theta) * radius
      y = gaussian(random) * (0.08 + radius * 0.05)
      energy = 0.75 + random() * 0.25
    } else if (population < 0.8) {
      const radius = 0.65 + Math.pow(random(), 0.72) * 9.4
      const arm = Math.floor(random() * 4)
      const armOffset = arm * (Math.PI * 0.5)
      const spread = gaussian(random) * (0.08 + (1 - radius / 11) * 0.3)
      const theta = armOffset + Math.log(radius + 0.75) * 2.65 + spread
      const radialNoise = gaussian(random) * (0.07 + radius * 0.035)
      x = Math.cos(theta) * (radius + radialNoise) * 1.12
      z = Math.sin(theta) * (radius + radialNoise)
      y = gaussian(random) * (0.035 + radius * 0.028)
      energy = Math.max(0.12, 0.88 - radius * 0.065 + random() * 0.16)
    } else if (population < 0.93) {
      const radius = 5 + Math.pow(random(), 0.8) * 8
      const theta = random() * Math.PI * 2
      x = Math.cos(theta) * radius * 1.16
      z = Math.sin(theta) * radius
      y = gaussian(random) * (0.3 + radius * 0.06)
      energy = 0.08 + random() * 0.2
    } else {
      const radius = 11 + random() * 13
      const theta = random() * Math.PI * 2
      x = Math.cos(theta) * radius
      z = Math.sin(theta) * radius
      y = gaussian(random) * 3.5
      energy = 0.05 + random() * 0.14
    }

    positions[offset] = x
    positions[offset + 1] = y
    positions[offset + 2] = z
    seeds[index] = random()
    sizes[index] = 0.45 + Math.pow(random(), 4) * 2.2
    energies[index] = energy

  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aEnergy', new THREE.BufferAttribute(energies, 1))
  geometry.computeBoundingSphere()
  return geometry
}

export function createStarGeometry(count: number) {
  const random = mulberry32(421977)
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const radius = 20 + Math.pow(random(), 0.45) * 55
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[index * 3 + 1] = radius * Math.cos(phi) * 0.7
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    sizes[index] = random() > 0.985 ? 2.2 : 0.3 + random() * 0.7
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  return geometry
}
