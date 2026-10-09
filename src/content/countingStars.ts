// Original example grid for the four-neighbour component idea in Mani's public
// CountingStarsBFS.cpp. These are example cells, never a contest result or metric.
export const starGrid = [
  '--##--##',
  '#-##--##',
  '#---####',
  '#####---',
  '--###-##',
  '---##---',
]
export function connectedComponents(grid: readonly string[]) {
  const visited = new Set<number>(),
    components: number[][] = [],
    width = grid[0]?.length ?? 0
  if (grid.some((row) => row.length !== width))
    throw new RangeError('Grid rows must have equal widths')
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < width; x++) {
      const start = y * width + x
      if (grid[y][x] !== '-' || visited.has(start)) continue
      const queue = [start]
      visited.add(start)
      for (let i = 0; i < queue.length; i++) {
        const cell = queue[i],
          row = Math.floor(cell / width),
          col = cell % width
        for (const [dy, dx] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const r = row + dy,
            c = col + dx,
            n = r * width + c
          if (
            r >= 0 &&
            r < grid.length &&
            c >= 0 &&
            c < width &&
            grid[r][c] === '-' &&
            !visited.has(n)
          ) {
            visited.add(n)
            queue.push(n)
          }
        }
      }
      components.push(queue)
    }
  return components
}
export const starComponents = connectedComponents(starGrid)
