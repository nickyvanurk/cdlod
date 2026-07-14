precision highp float;

uniform vec3 colors[LOD_LEVELS];
uniform bool enableLodColors;
uniform vec3 fogColor;
uniform float fogDensity;

uniform sampler2D groundGrass;
uniform sampler2D groundDirt;
uniform sampler2D groundRock;
uniform float detailTile;
uniform float detailFade;

flat varying int vLodLevel;
varying vec3 vNormal;
varying float vHeightNorm;
varying float vDist;
varying vec2 vWorldXZ;

#include terrain_common.glsl;

const vec3 DEEP_WATER = vec3(0.043, 0.196, 0.235);
const vec3 SHALLOW_WATER = vec3(0.180, 0.560, 0.580);
const vec3 SAND = vec3(0.760, 0.700, 0.550);
const vec3 GRASS = vec3(0.353, 0.412, 0.243);
const vec3 FOREST = vec3(0.145, 0.235, 0.118);
const vec3 ROCK_LOW = vec3(0.451, 0.376, 0.325);
const vec3 ROCK_HIGH = vec3(0.376, 0.337, 0.337);
const vec3 SNOW = vec3(0.945, 0.949, 0.960);

const vec3 SUN_DIR = normalize(vec3(-0.5, 0.72, 0.48));
const vec3 SKY_LIGHT = vec3(0.42, 0.52, 0.66);
const vec3 GROUND_BOUNCE = vec3(0.26, 0.26, 0.18);

/**
 * Ground texture sampled at two scales and mixed, so the tiling period never lands on one
 * obvious frequency across a 16km map.
 */
vec3 detail(sampler2D tex, vec2 worldXZ) {
  vec3 a = texture2D(tex, worldXZ / detailTile).rgb;
  vec3 b = texture2D(tex, worldXZ / (detailTile * 5.7)).rgb;
  return mix(a, b, 0.45);
}

void main() {
  if(enableLodColors) {
    gl_FragColor = vec4(colors[vLodLevel], 1.0);
    return;
  }

  vec3 normal = normalize(vNormal);
  float flatness = normal.y;
  float height = vHeightNorm;
  float land = smoothstep(seaLevel - 0.004, seaLevel + 0.004, height);

  // Terrain above the waterline, banded by altitude. The sand band is deliberately narrow:
  // most land sits in the lowest tenth of the altitude range, so a wide band turns the
  // whole coastal plain into beach.
  float aboveSea = (height - seaLevel) / (1.0 - seaLevel);
  vec3 albedo = SAND;
  albedo = mix(albedo, GRASS, smoothstep(0.002, 0.012, aboveSea));
  albedo = mix(albedo, ROCK_LOW, smoothstep(0.090, 0.260, aboveSea));
  albedo = mix(albedo, ROCK_HIGH, smoothstep(0.300, 0.520, aboveSea));

  // Forest is a noise mask rather than a band, so lowlands are patchy not striped. Scaled
  // in world units so patch size is a real-world size, independent of map extent.
  float forestNoise = fbm3(vWorldXZ / 900.0 + 17.0) * 0.5 + 0.5;
  float forestBand = smoothstep(0.006, 0.030, aboveSea) * (1.0 - smoothstep(0.150, 0.340, aboveSea));
  float forest = smoothstep(0.45, 0.62, forestNoise) * forestBand * smoothstep(0.70, 0.92, flatness);
  albedo = mix(albedo, FOREST, forest);

  // Snow accumulates on flats and shallow slopes; steep faces stay bare rock. This is what
  // produces the dark exposed crests.
  float snowNoise = fbm3(vWorldXZ / 1400.0 + 63.0) * 0.05;
  float snowLine = smoothstep(0.170, 0.380, aboveSea + snowNoise);
  float snow = snowLine * pow(clamp(flatness, 0.0, 1.0), 2.0);
  albedo = mix(albedo, SNOW, smoothstep(0.12, 0.55, snow));

  // Water: depth-graded teal, with the seabed showing through the shallows.
  float depth = clamp((seaLevel - height) / 0.10, 0.0, 1.0);
  vec3 water = mix(SHALLOW_WATER, DEEP_WATER, depth);
  water = mix(mix(SAND, water, 0.55), water, smoothstep(0.0, 0.35, depth));

  albedo = mix(water, albedo, land);

  // Ground textures near the camera, blending back to the procedural bands with distance.
  //
  // Blended as colour, not multiplied as a detail map. These are stylised flat colours --
  // the pack's grass map has a standard deviation of ~0.006 -- so modulating with them adds
  // nothing visible. Used as colour they at least carry the art style's palette and its
  // faint swirls; the actual close-up scale cue comes from the scattered grass and trees,
  // which is how this art style is built.
  float fade = 1.0 - smoothstep(detailFade * 0.4, detailFade, vDist);
  if(fade > 0.001 && land > 0.001) {
    vec3 grassTex = detail(groundGrass, vWorldXZ);
    vec3 rockTex = detail(groundRock, vWorldXZ);
    vec3 dirtTex = detail(groundDirt, vWorldXZ);

    // Follow the same drivers as the colour bands so texture and colour agree.
    float rocky = max(smoothstep(0.090, 0.300, aboveSea), 1.0 - smoothstep(0.72, 0.93, flatness));
    vec3 tex = mix(grassTex, rockTex, rocky);
    tex = mix(tex, dirtTex, smoothstep(0.012, 0.002, aboveSea));

    // Snow keeps its own clean surface; a rock texture under it reads as dirty snow.
    float keep = (1.0 - smoothstep(0.12, 0.55, snow)) * land * fade * 0.75;
    albedo = mix(albedo, tex, keep);
  }

  // Hillshade. Water stays flat-lit so it does not pick up seabed relief.
  float diffuse = mix(1.0, clamp(dot(normal, SUN_DIR), 0.0, 1.0) * 0.72 + 0.22, land);
  vec3 color = albedo * diffuse;

  // Hemispheric ambient: sky from above, bounced ground light from below. Keeps shaded
  // slopes in the scene's palette instead of collapsing to flat grey.
  vec3 ambient = mix(GROUND_BOUNCE, SKY_LIGHT, normal.y * 0.5 + 0.5);
  color += albedo * ambient * mix(0.0, 0.30, land);

  // Snow is near-white albedo, so direct plus ambient drives it well past 1.0 and every lit
  // face clips to the same flat white, erasing the relief the extra octaves just bought.
  // Roll the highlights off instead of clamping them.
  color = color / (1.0 + max(vec3(0.0), color - 0.85) * 0.9);

  // Aerial perspective. At a 16km view distance this is doing most of the work of conveying
  // scale: without it, a distant range reads as a small nearby ridge because nothing tells
  // the eye how far away it is.
  float fog = 1.0 - exp(-vDist * fogDensity);
  color = mix(color, fogColor, fog);

  gl_FragColor = vec4(color, 1.0);
}
