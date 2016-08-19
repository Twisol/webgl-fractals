const _GL = WebGLRenderingContext;

/// A simple vertex format consisting solely of pairs of floating-point values.
const VERTEX2F = {
  components: 2,
  type: _GL.FLOAT,
  stride: 8,
  offset: 0,
};

export default {
  "quad": {
    primitive_type: _GL.TRIANGLE_STRIP,
    vertex_count: 4,
    attributes: {
      "a_vertex": {
        format: VERTEX2F,
        vertices: new Float32Array([
          -1, -1,
          -1,  1,
           1, -1,
           1,  1
        ]),
      },
    },
  },
};
