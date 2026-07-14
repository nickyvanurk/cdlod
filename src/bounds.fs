precision highp float;

uniform vec2 probeCenter;
uniform float probeSize;

varying vec2 vUv;

#include terrain_common.glsl;

void main() {
  // The probe covers a probeSize box centred on probeCenter, so the same shader serves both
  // the whole-map bounds grid and any smaller window.
  vec2 worldXZ = probeCenter + vec2(vUv.x - 0.5, 0.5 - vUv.y) * probeSize;
  float h = clamp(terrainHeightNorm(worldXZ), 0.0, 1.0);

  // Packed to 16 bits across R and G rather than written to a float target.
  //
  // The grid has to out-resolve the quadtree -- a node narrower than a couple of samples
  // cannot be bounded from it -- and at 2048 a float target would be a 64MB readback. Packed,
  // the same grid costs 16MB, needs no float-render-target extension, and reads back on the
  // fast path. 16 bits is 0.04m against a 2600m height range: two orders below the margin.
  float scaled = h * 255.0;
  float hi = floor(scaled);
  gl_FragColor = vec4(hi / 255.0, scaled - hi, 0.0, 1.0);
}
