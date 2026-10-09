// Ordered x control points guarantee a noncrossing folded centerline. The three
// lobes reproduce the inspected crest / deeper trough / small recovery topology.
export function loadingWave(
  width: number,
  height: number,
  p: number,
  amplitude: number,
  phase: number,
  bounce: number,
  reduced: boolean,
) {
  const y = height * 0.5,
    x = width * p,
    span = Math.min(x * 0.7, height * 0.16),
    h = height * 0.063 * amplitude * Math.min(1, span / (height * 0.16))
  const breath = reduced
      ? 1
      : 1 + 0.025 * Math.sin((phase * Math.PI * 2) / 3.4),
    drift = reduced
      ? 0
      : 1.3 * Math.sin((phase * Math.PI * 2) / 3.4) * amplitude
  const start = Math.max(0, x - span + drift),
    end = x + bounce * Math.min(5, height * 0.005),
    w = Math.max(0, end - start),
    a = h * breath
  const X = (q: number) => start + w * q
  return `M0 ${y} H${start} C${X(0.08)} ${y} ${X(0.1)} ${y} ${X(0.12)} ${y - a * 0.72} C${X(0.14)} ${y - a * 0.86} ${X(0.2)} ${y - a * 0.86} ${X(0.22)} ${y - a * 0.72} C${X(0.24)} ${y - a * 0.6} ${X(0.26)} ${y + a * 0.96} ${X(0.28)} ${y + a} C${X(0.3)} ${y + a * 1.14} ${X(0.38)} ${y + a * 1.14} ${X(0.4)} ${y + a} C${X(0.42)} ${y + a * 0.88} ${X(0.44)} ${y - a * 0.3} ${X(0.46)} ${y - a * 0.36} C${X(0.49)} ${y - a * 0.5} ${X(0.57)} ${y - a * 0.5} ${X(0.6)} ${y - a * 0.36} C${X(0.62)} ${y - a * 0.12} ${X(0.64)} ${y} ${X(0.72)} ${y} H${end}`
}
