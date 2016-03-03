precision highp float;

// Compile-time constants - {{}} are template variables
const int ITERATIONS = {{ITERATIONS}};
const int NUMROOTS = {{NUMROOTS}};

// Camera control
uniform vec2 u_center;
uniform float u_zoom;

// Color control
uniform float u_brightness;
uniform vec3 u_color;
uniform float u_root_radius;

// Point transformation and tolerance
uniform vec2 u_a;
uniform float u_eps;

// Fractal parameters
uniform vec2 u_roots[NUMROOTS+1];
uniform vec2 u_poly[NUMROOTS+1];
uniform vec2 u_deriv[NUMROOTS+1];

// Current point
varying vec2 v_vertex;


// Complex multiplication
vec2 compmul(const vec2 a, const vec2 b) {
  return b[0]*a + b[1]*vec2(-a[1], a[0]);
}

// Complex division
vec2 compdiv(const vec2 a, const vec2 b){
  return compmul(a, b*vec2(1, -1)) / dot(b, b);
}

// Computes z - a*poly(z)/deriv(z)
vec2 approximation(const vec2 z) {
  vec2 zx = vec2(1, 0);  // Collects successive powers of z
  vec2 numerator = vec2(0, 0);  // Collects the polynomial's value
  vec2 denominator = vec2(0, 0);  // Collects the derivative's value
  for (int i = 0; i < NUMROOTS+1; i += 1) {
    numerator += compmul(u_poly[i], zx);
    denominator += compmul(u_deriv[i], zx);
    zx = compmul(zx, z);
  }

  return z - compmul(u_a, compdiv(numerator, denominator));
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

  float b = 0.0;
  for (int i = 0; i < ITERATIONS; i += 1) {
    p = approximation(p);

    for (int j = 0; j < NUMROOTS; j += 1) {
      if (dot(p - u_roots[j], p - u_roots[j]) < tolerance) {
        b += float(j+1)*u_brightness;
      }
    }
  }

  gl_FragColor = vec4((b/float(ITERATIONS))*u_color, 1.0);
}
