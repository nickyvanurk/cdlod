
precision mediump float;

uniform float sectorSize;
uniform float lodRanges[5];
uniform sampler2D heightmap;

attribute float lodLevel;

flat varying int vLodLevel;
varying vec2 vUv;

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

  // Get the correct height value from 2D morphed position
  vec3 worldPos = (instanceMatrix * vec4(position, 1.0)).xyz; // pos.y == 0
  float dist = length(cameraPosition - worldPos);
  float morphK = morphValue(dist);
  vec2 morphedPos = morphVertex(position.xz, uv, morphK);
  vec3 morphedWorldPos = (instanceMatrix * vec4(morphedPos.x, 0.0, morphedPos.y, 1.0)).xyz;
  vUv = (vec2(morphedWorldPos.x, -morphedWorldPos.z) + 2049.0) / 4098.0;
  morphedWorldPos.y = (texture2D(heightmap, vUv).r) * 2600.0 - 700.0;

  // Use it to calculate the final 3D morphed position
  worldPos = (instanceMatrix * vec4(position.x, morphedWorldPos.y, position.z, 1.0)).xyz;
  dist = length(cameraPosition - worldPos);
  morphK = morphValue(dist);
  morphedPos = morphVertex(position.xz, uv, morphK);
  morphedWorldPos.xz = (instanceMatrix * vec4(morphedPos.x, 0.0, morphedPos.y, 1.0)).xz;

  gl_Position = projectionMatrix * viewMatrix * vec4(morphedWorldPos, 1.0);
}