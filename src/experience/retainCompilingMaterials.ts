import type { Material, Mesh, WebGLRenderer } from 'three'

// Three r180's asynchronous readiness poll still reads material properties
// after a surface unmounts. Retain those properties until every poll using
// them settles; shader output and the owner's disposal request stay intact.
export function retainCompilingMaterials(renderer: WebGLRenderer) {
  const compile = renderer.compileAsync.bind(renderer)
  const leases = new WeakMap<
    Material,
    {
      count: number
      requested: boolean
      dispose: Material['dispose']
    }
  >()
  renderer.compileAsync = (scene, camera, targetScene) => {
    const materials = new Set<Material>()
    scene.traverse((object) => {
      const material = (object as Mesh).material
      if (material)
        (Array.isArray(material) ? material : [material]).forEach((value) =>
          materials.add(value),
        )
    })
    for (const material of materials) {
      let lease = leases.get(material)
      if (!lease) {
        lease = { count: 0, requested: false, dispose: material.dispose }
        leases.set(material, lease)
        const retained = lease
        material.dispose = () => {
          retained.requested = true
        }
      }
      lease.count++
    }
    const release = () => {
      for (const material of materials) {
        const lease = leases.get(material)!
        if (--lease.count) continue
        leases.delete(material)
        material.dispose = lease.dispose
        if (lease.requested) material.dispose()
      }
    }
    try {
      return compile(scene, camera, targetScene).finally(release)
    } catch (error) {
      release()
      throw error
    }
  }
}
