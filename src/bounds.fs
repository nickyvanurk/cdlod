precision highp float;

uniform vec2 probeCenter;
uniform float probeSize;

varying vec2 vUv;

#include terrain_common.glsl;

void main() {
  // The probe covers a probeSize box centred on probeCenter, so the same shader serves both
  // the whole-map bounds grid and the high-resolution window that follows the camera.
  vec2 worldXZ = probeCenter + vec2(vUv.x - 0.5, 0.5 - vUv.y) * probeSize;
  gl_FragColor = vec4(terrainHeightNorm(worldXZ), 0.0, 0.0, 1.0);
}
