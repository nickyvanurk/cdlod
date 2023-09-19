attribute float sectorSize;

void main() {
  vec3 worldPos = (instanceMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}