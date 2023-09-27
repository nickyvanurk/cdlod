precision mediump float;
precision highp sampler2DArray;

uniform sampler2D heightmap;
uniform vec3 colors[5];
uniform bool enableLodColors;
uniform sampler2DArray atlas;

flat varying int vLodLevel;
flat varying float vHeightScale;

void main() {
  vec4 lodColor = vec4(colors[vLodLevel], 1.0);
  vec4 heightColor = vec4(1.0, 1.0, 1.0, 1.0) * vHeightScale;

  gl_FragColor = enableLodColors ? lodColor : heightColor;
}