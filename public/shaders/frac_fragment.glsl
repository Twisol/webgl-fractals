precision highp float;

// Compile-time constants - {{}} are template variables
const int ITERATIONS = {{ITERATIONS}};
const int NUMROOTS = {{NUMROOTS}};

// Camera control
uniform vec2 u_center;
uniform float u_zoom;

// Color control
uniform float u_brightness;
uniform float u_root_radius;

// Point transformation and tolerance
uniform float u_eps;

// Polynomial roots
uniform vec2 u_roots[NUMROOTS];
uniform vec2 u_numerator[NUMROOTS+1];
uniform vec2 u_denominator[NUMROOTS];
uniform vec3 u_colors[NUMROOTS];

// Current point
varying vec2 v_vertex;


// Complex multiplication
vec2 compmul(const vec2 a, const vec2 b) {
  return b[0]*a + b[1]*vec2(-a[1], a[0]);
}

// Complex division
vec2 compdiv(const vec2 a, const vec2 b) {
  return compmul(a, b*vec2(1, -1)) / dot(b, b);
}

// Computes z - poly(z)/deriv(z),
// where poly(x) = prod_{i=1}^{NUMROOTS} u_root[i]^u_multiplicities[i]
vec2 approximation(const vec2 z) {
  vec2 num = u_numerator[0];
  vec2 denom = vec2(0, 0);
  for (int i = 1; i < NUMROOTS+1; i += 1) {
    num = compmul(num, z) + u_numerator[i];
    denom = compmul(denom, z) + u_denominator[i-1];
  }

  return z - compdiv(num, denom);
}

void main() {
  float tolerance = u_eps*u_eps;
  vec2 p = v_vertex / u_zoom + u_center;

  // Highlight the roots
  for (int i = 0; i < NUMROOTS; i += 1) {
    if (dot(p - u_roots[i], p - u_roots[i]) < u_root_radius*u_root_radius) {
      gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
      return;
    }
  }

  vec3 b = vec3(0.0, 0.0, 0.0);
  for (int i = 0; i < ITERATIONS; i += 1) {
    p = approximation(p);

    for (int j = 0; j < NUMROOTS; j += 1) {
      if (dot(p - u_roots[j], p - u_roots[j]) < tolerance) {
        b += u_colors[j];
      }
    }
  }

  gl_FragColor = vec4(b/float(ITERATIONS) * u_brightness, 1.0);
}
