const _GL = WebGLRenderingContext;

/// A simple vertex format consisting solely of
/// pairs of floating-point position data.
//
// The fact that it's _position_ data is used to
// determine which attribute it's assigned to
// in the shader.
const VERTEX2F = {
  "position": {
    components: 2,
    type: _GL.FLOAT,
    stride: 8,
    offset: 0
  },
};

export default {
  "quad": {
    primitive_type: _GL.TRIANGLE_STRIP,
    format: VERTEX2F,
    vertices: new Float32Array([
      -1, -1,
      -1,  1,
       1, -1,
       1,  1
    ]),
    vertex_count: 4,
  },
};
