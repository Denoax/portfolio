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
  const historyPositions = new Float32Array(count * 3)
  const streamPositions = new Float32Array(count * 3)
  const algorithmPositions = new Float32Array(count * 3)
  const dualPositions = new Float32Array(count * 3)
  const humanPositions = new Float32Array(count * 3)
  const horizonPositions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const energies = new Float32Array(count)
  const narrativeEnergy = new Float32Array(count)
  const historyAnchors = [
    [-5.5, -1.2],
    [0.25, 1.25],
    [5.45, -0.45],
  ]
  const graphNodes = [
    [-7.5, -2.6], [-6.1, 1.7], [-4.6, -0.2], [-2.9, 2.8],
    [-2.1, -2.4], [-0.1, 0.5], [1.4, 2.9], [2.6, -1.7],
    [4.4, 1.1], [5.8, -2.8], [7.4, 2.1], [8.4, -0.3],
  ]
  const graphEdges = [
    [0, 1], [0, 2], [1, 3], [1, 2], [2, 3], [2, 4], [2, 5], [3, 6],
    [4, 5], [4, 7], [5, 6], [5, 7], [5, 8], [6, 8], [7, 8], [7, 9],
    [8, 10], [8, 11], [9, 11], [10, 11],
  ]
  const optimalEdges = new Set([1, 6, 12, 17])
  const humanAnchors = [
    [-6, 1.8], [-1.7, -2.2], [3.2, 2.1], [6.2, -1.15],
  ]

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

    const anchorIndex = index % historyAnchors.length
    const anchor = historyAnchors[anchorIndex]
    const orbitAngle = random() * Math.PI * 2 + anchorIndex * 0.7
    const orbitRadius = 0.35 + Math.pow(random(), 0.7) * 2.35
    historyPositions[offset] = anchor[0] + Math.cos(orbitAngle) * orbitRadius * 1.35
    historyPositions[offset + 1] = anchor[1] + Math.sin(orbitAngle) * orbitRadius * 0.42
    historyPositions[offset + 2] = gaussian(random) * (0.12 + orbitRadius * 0.2)

    const lane = index % 6
    const streamX = -11 + random() * 22
    streamPositions[offset] = streamX
    streamPositions[offset + 1] = (lane - 2.5) * 0.72 + Math.sin(streamX * 0.58 + lane) * 0.12
    streamPositions[offset + 2] = gaussian(random) * 0.22 + Math.sin(streamX * 0.2) * 0.18

    const edgeIndex = index % graphEdges.length
    const edge = graphEdges[edgeIndex]
    const start = graphNodes[edge[0]]
    const end = graphNodes[edge[1]]
    const edgeProgress = random()
    const lineNoise = gaussian(random) * 0.045
    algorithmPositions[offset] = start[0] + (end[0] - start[0]) * edgeProgress + lineNoise
    algorithmPositions[offset + 1] = start[1] + (end[1] - start[1]) * edgeProgress + lineNoise
    algorithmPositions[offset + 2] = gaussian(random) * 0.11
    narrativeEnergy[index] = optimalEdges.has(edgeIndex) ? 1 : random() * 0.28

    const dualSide = index % 2 === 0 ? -1 : 1
    const dualRadius = 0.35 + Math.pow(random(), 0.62) * 4.4
    const dualAngle = random() * Math.PI * 2 + Math.log(dualRadius + 0.5) * 2.1 * dualSide
    dualPositions[offset] = dualSide * 3.4 + Math.cos(dualAngle) * dualRadius
    dualPositions[offset + 1] = Math.sin(dualAngle) * dualRadius * 0.62
    dualPositions[offset + 2] = gaussian(random) * (0.08 + dualRadius * 0.12)

    const humanAnchor = humanAnchors[index % humanAnchors.length]
    const signalRadius = 0.25 + Math.pow(random(), 0.64) * 2.15
    const signalAngle = random() * Math.PI * 2
    const irregularity = 1 + Math.sin(signalAngle * 3 + anchorIndex) * 0.22
    humanPositions[offset] = humanAnchor[0] + Math.cos(signalAngle) * signalRadius * irregularity
    humanPositions[offset + 1] = humanAnchor[1] + Math.sin(signalAngle) * signalRadius * 0.68
    humanPositions[offset + 2] = gaussian(random) * (0.12 + signalRadius * 0.12)

    const horizonScatter = random()
    const horizonRadius = horizonScatter > 0.78 ? Math.pow(random(), 0.7) * 8 : Math.pow(random(), 2.8) * 2.5
    const horizonAngle = random() * Math.PI * 2
    horizonPositions[offset] = 3.9 + Math.cos(horizonAngle) * horizonRadius * 1.8
    horizonPositions[offset + 1] = Math.sin(horizonAngle) * horizonRadius * 0.18
    horizonPositions[offset + 2] = gaussian(random) * (0.08 + horizonRadius * 0.15)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aHistory', new THREE.BufferAttribute(historyPositions, 3))
  geometry.setAttribute('aStream', new THREE.BufferAttribute(streamPositions, 3))
  geometry.setAttribute('aAlgorithm', new THREE.BufferAttribute(algorithmPositions, 3))
  geometry.setAttribute('aDual', new THREE.BufferAttribute(dualPositions, 3))
  geometry.setAttribute('aHuman', new THREE.BufferAttribute(humanPositions, 3))
  geometry.setAttribute('aHorizon', new THREE.BufferAttribute(horizonPositions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aEnergy', new THREE.BufferAttribute(energies, 1))
  geometry.setAttribute('aNarrativeEnergy', new THREE.BufferAttribute(narrativeEnergy, 1))
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
