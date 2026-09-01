export const galaxyVertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  attribute float aEnergy;
  attribute float aNarrativeEnergy;
  attribute vec3 aHistory;
  attribute vec3 aStream;
  attribute vec3 aAlgorithm;
  attribute vec3 aDual;
  attribute vec3 aHuman;
  attribute vec3 aHorizon;

  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPixelRatio;
  uniform float uMotion;
  uniform float uState;
  uniform float uVelocity;

  varying float vEnergy;
  varying float vNarrativeEnergy;
  varying float vSeed;

  float cinematicEase(float value) {
    return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
  }

  vec3 statePosition(float state) {
    if (state >= 7.0) return aHorizon;
    float segment = floor(state);
    float blend = cinematicEase(fract(state));
    vec3 galaxySignal = position * 0.86;
    vec3 galaxyIdentity = position;
    if (segment < 1.0) return mix(galaxySignal, galaxyIdentity, blend);
    if (segment < 2.0) return mix(galaxyIdentity, aHistory, blend);
    if (segment < 3.0) return mix(aHistory, aStream, blend);
    if (segment < 4.0) return mix(aStream, aAlgorithm, blend);
    if (segment < 5.0) return mix(aAlgorithm, aDual, blend);
    if (segment < 6.0) return mix(aDual, aHuman, blend);
    return mix(aHuman, aHorizon, blend);
  }

  void main() {
    vec3 transformed = statePosition(uState);
    float radius = length(transformed.xz);
    float galaxyPresence = 1.0 - smoothstep(1.4, 2.25, uState);
    float rotation = uTime * (0.0015 + 0.01 / (1.0 + radius)) * uMotion * galaxyPresence;
    float cs = cos(rotation);
    float sn = sin(rotation);
    transformed.xz = mat2(cs, -sn, sn, cs) * transformed.xz;

    vec2 influenceCenter = uPointer * vec2(5.8, 3.2);
    float pointerDistance = length(transformed.xy - influenceCenter);
    float interactiveState = max(galaxyPresence, smoothstep(5.7, 6.1, uState) * (1.0 - smoothstep(6.6, 7.0, uState)));
    float influence = exp(-pointerDistance * 0.62) * 0.1 * uMotion * interactiveState;
    transformed.xy += normalize(influenceCenter - transformed.xy + 0.0001) * influence;
    transformed.y += sin(uTime * 0.18 + aSeed * 31.0) * 0.018 * uMotion;
    transformed.x += sin(aSeed * 61.0) * min(0.18, abs(uVelocity) * 0.08);

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(230.0 / -viewPosition.z, 0.15, 5.0);
    gl_PointSize = max(1.0, aSize * uPixelRatio * perspective * 0.68);
    vEnergy = aEnergy;
    vNarrativeEnergy = aNarrativeEnergy;
    vSeed = aSeed;
  }
`

export const galaxyFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uState;
  varying float vEnergy;
  varying float vNarrativeEnergy;
  varying float vSeed;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float distanceToCenter = length(center);
    float soft = smoothstep(0.5, 0.05, distanceToCenter);
    float core = smoothstep(0.22, 0.0, distanceToCenter);
    if (soft <= 0.002) discard;

    vec3 graphite = vec3(0.29, 0.31, 0.36);
    vec3 starlight = vec3(0.95, 0.94, 0.90);
    vec3 ion = vec3(0.478, 0.655, 1.0);
    vec3 amber = vec3(0.91, 0.63, 0.36);
    float algorithmPresence = smoothstep(3.45, 4.0, uState) * (1.0 - smoothstep(4.45, 5.0, uState));
    float resolvedEnergy = mix(vEnergy, max(vEnergy * 0.35, vNarrativeEnergy), algorithmPresence);
    vec3 color = mix(graphite, starlight, smoothstep(0.08, 0.68, resolvedEnergy));
    color = mix(color, ion, smoothstep(0.42, 0.78, resolvedEnergy) * 0.32);
    color = mix(color, amber, smoothstep(0.86, 1.0, resolvedEnergy) * (0.68 + algorithmPresence * 0.2));
    float twinkle = 0.88 + sin(uTime * 0.22 + vSeed * 83.0) * 0.12;
    float horizonRestraint = 1.0 - smoothstep(6.2, 7.0, uState) * 0.48;
    float alpha = (soft * 0.3 + core * 0.18) * twinkle * (0.2 + resolvedEnergy * 0.72) * horizonRestraint;
    gl_FragColor = vec4(color, alpha);
  }
`

export const starVertexShader = /* glsl */ `
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vSize;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(1.0, aSize * uPixelRatio * 180.0 / -viewPosition.z);
    vSize = aSize;
  }
`

export const starFragmentShader = /* glsl */ `
  varying float vSize;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.08, d) * (vSize > 1.5 ? 0.7 : 0.22);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(0.76, 0.79, 0.86, alpha);
  }
`
