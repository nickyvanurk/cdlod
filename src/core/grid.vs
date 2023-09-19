precision mediump float;

attribute float sectorSize;
attribute float lodLevel;

flat varying int vLodLevel;

void main() {
  // visualization: pass lod level for color tinting
  vLodLevel = int(floor(lodLevel));

  vec3 worldPos = (instanceMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}