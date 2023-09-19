precision mediump float;

flat varying int vLodLevel;
uniform vec3 colors[5];

void main() {
  gl_FragColor = vec4(colors[vLodLevel], 1.0);
}