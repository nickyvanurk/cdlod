precision mediump float;

uniform sampler2D heightmap;
uniform sampler2D albedomap;
uniform vec3 colors[5];
uniform bool enableLodColors;

flat varying int vLodLevel;
flat varying vec2 vUv;

void main() {
  vec4 lodColor = vec4(colors[vLodLevel], 1.0);
  vec4 heightColor = texture2D(heightmap, vUv);
  vec4 albedo = texture2D(albedomap, vUv);

  gl_FragColor = enableLodColors ? lodColor : albedo;
}