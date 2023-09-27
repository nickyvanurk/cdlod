
precision highp float;

uniform float sectorSize;
uniform float lodRanges[5];
uniform sampler2D heightmap;
uniform sampler2D atlas;

attribute float lodLevel;

flat varying int vLodLevel;
flat varying float vHeightScale;

void main() {
  // visualization: pass lod level for color tinting
  vLodLevel = int(floor(lodLevel));

  vec3 worldPos = (instanceMatrix * vec4(position, 1.0)).xyz;


  worldPos.y = (texture2D(atlas, (vec2(worldPos.x, worldPos.z) + 4096.0) / (4096.0 * 2.0)).r) * 800.0;
  vHeightScale = worldPos.y / 800.0;

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}