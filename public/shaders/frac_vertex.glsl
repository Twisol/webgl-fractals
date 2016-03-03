precision highp float;

attribute vec2 a_vertex;
uniform float u_aspect;

varying vec2 v_vertex;

void main() {
  gl_Position = vec4(a_vertex, 0.0, 1.0);
  v_vertex = a_vertex * vec2(u_aspect, 1.0);
}
