
precision mediump float;

uniform float sectorSize;
uniform float lodRanges[5];
uniform sampler2D heightmap;
uniform sampler2D atlas;

attribute float lodLevel;

flat varying int vLodLevel;
flat varying vec2 vUv;

float morphValue(float dist) {
  float low = 0.0;
  if (lodLevel != 4.0) {
    low = lodRanges[int(lodLevel) + 1];
  }
  float high = lodRanges[int(lodLevel)];
  float factor = (dist - low) / (high - low);
  return smoothstep(0.7, 1.0, factor);
}

vec2 morphVertex(vec2 vertex, vec2 mesh_pos, float morphValue) {
  vec2 gridDim = vec2(sectorSize, sectorSize);
  vec2 fraction = fract(mesh_pos * gridDim * 0.5) * 2.0 / gridDim;
  return vertex - fraction * morphValue;
}

void main() {
  // visualization: pass lod level for color tinting
  vLodLevel = int(floor(lodLevel));

  vec3 worldPos = (instanceMatrix * vec4(position, 1.0)).xyz;

  float dist = length(cameraPosition - worldPos);
  float morphK = morphValue(dist);
  vec2 morphedPos = morphVertex(position.xz, uv, morphK);

  vec3 morphedWorldPos = (instanceMatrix * vec4(morphedPos.x, 0.0, morphedPos.y, 1.0)).xyz;

  vUv = (vec2(morphedWorldPos.x, -morphedWorldPos.z) + (4096.0 * 2.0)) / (4096.0 * 4.0);

  morphedWorldPos.y = (texture2D(atlas, (vec2(morphedWorldPos.x, morphedWorldPos.z) + 4096.0) / (4096.0 * 2.0)).r) * 800.0;

  gl_Position = projectionMatrix * viewMatrix * vec4(morphedWorldPos, 1.0);
}