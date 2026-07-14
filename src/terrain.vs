precision highp float;

uniform float sectorSize;
uniform float lodRanges[LOD_LEVELS];
uniform vec3 cameraPos;

attribute float lodLevel;

flat varying int vLodLevel;
varying vec3 vNormal;
varying float vHeightNorm;
varying float vDist;
varying vec2 vWorldXZ;

#include terrain_common.glsl;

float morphValue(float dist) {
  int level = int(lodLevel);

  // The finest level has no finer range below it, so its band starts at the camera. Clamping
  // the index as well as branching on it: a driver that if-converts the branch into a select
  // would evaluate lodRanges[LOD_LEVELS] and read off the end of the array.
  float low = 0.0;
  if(level != LOD_LEVELS - 1) {
    low = lodRanges[min(level + 1, LOD_LEVELS - 1)];
  }
  float high = lodRanges[level];
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
  float dist = length(cameraPos - worldPos);
  float morphK = morphValue(dist);
  vec2 morphedPos = morphVertex(position.xz, uv, morphK);
  vec3 morphedWorldPos = (instanceMatrix * vec4(morphedPos.x, 0.0, morphedPos.y, 1.0)).xyz;
  morphedWorldPos.y = terrainHeight(morphedWorldPos.xz);

  // Use it to calculate the final 3D morphed position
  worldPos = (instanceMatrix * vec4(position.x, morphedWorldPos.y, position.z, 1.0)).xyz;
  dist = length(cameraPos - worldPos);
  morphK = morphValue(dist);
  morphedPos = morphVertex(position.xz, uv, morphK);
  morphedWorldPos.xz = (instanceMatrix * vec4(morphedPos.x, 0.0, morphedPos.y, 1.0)).xz;

  // Take the normalized height straight from the field rather than dividing the world height
  // back by maxTerrainHeight. The GUI lets that reach 0, and 0.0/0.0 is NaN -- which would
  // propagate through every smoothstep in terrain.fs and out to gl_FragColor.
  float heightNorm = terrainHeightNorm(morphedWorldPos.xz);
  morphedWorldPos.y = heightNorm * maxTerrainHeight;

  // Normals are evaluated per-vertex, not per-fragment: the field costs ~20 noise samples
  // per evaluation, which is affordable across vertices but not across pixels. eps tracks
  // the vertex spacing so distant, coarse nodes sample a correspondingly smoother surface
  // instead of aliasing against detail their geometry cannot carry.
  float eps = max(1.0, dist * 0.004);
  vNormal = terrainNormal(morphedWorldPos.xz, eps);

  vHeightNorm = heightNorm;
  vWorldXZ = morphedWorldPos.xz;
  vDist = dist;

  gl_Position = projectionMatrix * viewMatrix * vec4(morphedWorldPos, 1.0);
}
