// Shared terrain definition. Included by terrain.vs, terrain.fs and bounds.fs so geometry,
// shading and culling bounds are all derived from one function and cannot disagree.
//
// The terrain is analytic: height is evaluated from world position, with no heightmap
// texture anywhere. That is deliberate. Every artifact this demo fought previously --
// bilinear facets, value-noise lattices, hash precision collapse at 16km coordinates,
// texel terracing -- came from sampling height off a grid and filtering it back. An
// analytic field has no grid to alias against, costs zero load time, and works at any map
// size, which is what lets terrain generation stay out of CDLOD's way.

uniform float mapSize;
uniform float maxTerrainHeight;
uniform float seaLevel;
uniform vec2 seedOffset;

/** Fraction of the map below the shoreline. */
const float SHORE = 0.3;

// --- Simplex noise (Ashima / Gustavson) ------------------------------------------------
// Gradient noise, not value noise. Value noise interpolates hashes on an integer lattice
// and shows that lattice as a regular waffle no matter which interpolant is used; simplex
// has no such structure.

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm2(vec2 p) {
  return (snoise(p) + snoise(p * 2.0) * 0.5) / 1.5;
}

float fbm3(vec2 p) {
  return (snoise(p) + snoise(p * 2.0) * 0.5 + snoise(p * 4.0) * 0.25) / 1.75;
}

float fbm4(vec2 p) {
  return (snoise(p) + snoise(p * 2.0) * 0.5 + snoise(p * 4.0) * 0.25 + snoise(p * 8.0) * 0.125) / 1.875;
}

/**
 * Ridged multifractal. Each octave is damped by the previous one's value, clamped so the
 * weight cannot compound to zero -- that is what keeps crests sharp and connected instead
 * of bubbly.
 *
 * Nine octaves takes the finest detail to roughly 15m across a 16km map. Seven left the
 * ground a smooth mass with nothing for the light to catch. The top octaves push the noise
 * coordinate past snoise's mod289 period so the pattern repeats a few times over the map,
 * but at 0.5^8 amplitude that is a couple of metres of relief -- not something the eye can
 * pick out.
 */
float ridged(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  float weight = 1.0;
  for (int i = 0; i < 9; i++) {
    float signal = 1.0 - abs(snoise(p));
    signal *= signal;
    signal *= weight;
    weight = clamp(signal * 2.2, 0.0, 1.0);
    sum += amp * signal;
    norm += amp;
    amp *= 0.5;
    p *= 2.05;
  }
  return sum / norm;
}

// --- Terrain ----------------------------------------------------------------------------

/** World XZ spans [-mapSize/2, mapSize/2] mapped to a 0..1 domain. */
vec2 worldToUv(vec2 worldXZ) {
  return (vec2(worldXZ.x, -worldXZ.y) + mapSize * 0.5) / mapSize;
}

/** Normalized 0..1 height. Shoreline sits at seaLevel by construction. */
float terrainHeightNorm(vec2 worldXZ) {
  vec2 uv = worldToUv(worldXZ);
  float u = uv.x;
  float v = uv.y;

  // A diagonal gradient puts high ground toward the north-west and open water toward the
  // south-east; noise makes the coastline irregular rather than a straight line.
  float gradient = 1.0 - (u * 0.55 + (1.0 - v) * 0.45);
  float maskWarp = fbm2(uv * 1.6 + seedOffset + 40.0) * 0.38;
  float maskDetail = fbm3(uv * 3.1 + seedOffset + 90.0) * 0.14;
  float mask = clamp(gradient * 1.15 - 0.04 + maskWarp + maskDetail, 0.0, 1.0);

  float landness = (mask - SHORE) / (1.0 - SHORE);

  // Seabed, descending gently from the shore. Kept smooth so water reads as a plane.
  if (landness <= 0.0) return seaLevel * (1.0 + landness * 0.85);

  // Domain warp bends ridgelines into sinuous ranges. Kept gentle: warping fbm by fbm is
  // the standard marble recipe, and past ~0.2 the terrain reads as polished stone.
  vec2 p = uv * 3.4 + seedOffset;
  p += vec2(fbm3(uv * 2.0 + seedOffset + 11.0), fbm3(uv * 2.0 + seedOffset + 71.0)) * 0.18;

  float mountains = ridged(p);
  float hills = fbm4(p * 2.2 + 5.0) * 0.5 + 0.5;

  float rise = landness * sqrt(sqrt(landness));

  // Inland is lifted onto a broad plateau and the ridges only add relief on top. Without
  // it the ridge troughs fall back to the coastal base and the range renders as a row of
  // isolated needles rather than high country.
  float plateau = rise * 0.46;

  // smoothstep rather than sqrt: any exponent below 1 has an infinite derivative at zero
  // and would crease the shoreline.
  float hillRamp = smoothstep(0.0, 0.18, landness);
  float relief = mountains * rise * 0.36 + hills * hillRamp * 0.14;

  return seaLevel + landness * 0.04 + (plateau + relief) * (1.0 - seaLevel);
}

/** World-space surface height. The single source of truth. */
float terrainHeight(vec2 worldXZ) {
  return terrainHeightNorm(worldXZ) * maxTerrainHeight;
}

/** Surface normal by central differences on the analytic field. */
vec3 terrainNormal(vec2 worldXZ, float eps) {
  float hL = terrainHeight(worldXZ - vec2(eps, 0.0));
  float hR = terrainHeight(worldXZ + vec2(eps, 0.0));
  float hD = terrainHeight(worldXZ - vec2(0.0, eps));
  float hU = terrainHeight(worldXZ + vec2(0.0, eps));
  return normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
}
