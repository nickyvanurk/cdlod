precision mediump float;

uniform sampler2D heightmap;
uniform vec3 colors[5];
uniform bool enableLodColors;
uniform sampler2D atlas;

flat varying int vLodLevel;
flat varying vec2 vUv;

void main() {
  vec4 lodColor = vec4(colors[vLodLevel], 1.0);
  vec4 texColor = texture2D(heightmap, vUv);

  gl_FragColor = enableLodColors ? lodColor : texColor;
}