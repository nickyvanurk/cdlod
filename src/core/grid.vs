
precision highp float;
precision highp sampler2DArray;

uniform float sectorSize;
uniform float lodRanges[5];
uniform sampler2D heightmap;
uniform sampler2DArray atlas;

attribute float lodLevel;

flat varying int vLodLevel;
flat varying float vHeightScale;

void main() {
  vLodLevel = int(floor(lodLevel));

  vec3 worldPos = (instanceMatrix * vec4(position, 1.0)).xyz;

  vHeightScale = texture(atlas, (vec3(uv[0], 1.0 - uv[1], 0))).r;
  worldPos.y = vHeightScale * 800.0;

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}