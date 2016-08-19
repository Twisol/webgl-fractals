export function fetch(shader_schema) {
  const vertex_xhr$ = $.fetch(shader_schema.vertex_source_path);
  const fragment_xhr$ = $.fetch(shader_schema.fragment_source_path);

  return new Promise(function(resolve, reject) {
    vertex_xhr$.then(function(vertex_xhr) {
      fragment_xhr$.then(function(fragment_xhr) {
        resolve({
          vertex_source: vertex_xhr.response,
          fragment_source: fragment_xhr.response,

          signature: shader_schema.signature,
        });
      });
    });
  });
}

export function apply_constants(shader_schema, constants) {
  let vertex_source = shader_schema.vertex_source;
  let fragment_source = shader_schema.fragment_source;

  let remaining_constants = [];
  for (let k of shader_schema.signature.constants) {
    if (k in constants) {
      let pattern = new RegExp(`{{${k}}}`, 'g');
      vertex_source = vertex_source.replace(pattern, constants[k]);
      fragment_source = fragment_source.replace(pattern, constants[k]);
    } else {
      remaining_constants.push(k);
    }
  }

  return {
    vertex_source: vertex_source,
    fragment_source: fragment_source,
    signature: {
      constants: remaining_constants,
      uniforms: shader_schema.signature.uniforms,
      attributes: shader_schema.signature.attributes,
    },
  };
}

export function compile(gl, shader_schema) {
  if (shader_schema.signature.constants.length > 0) {
    for (let k of shader_schema.signature.constants) {
      console.log(`Shader has undetermined constant ${k}`);
    }

    throw new Error("Shader has undetermined constants");
  }

  let vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, shader_schema.vertex_source);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    throw new Error("Unable to compile vertex shader");
  }

  let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, shader_schema.fragment_source);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(fragmentShader));
    throw new Error("Unable to compile fragment shader");
  }

  let program = gl.createProgram();
  gl.attachShader(program, fragmentShader);
  gl.attachShader(program, vertexShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(program));
    throw new Error("Unable to link shader program");
  }

  let uniforms = {};
  for (let k in shader_schema.signature.uniforms) {
    uniforms[k] = {
      location: gl.getUniformLocation(program, k),
      type: shader_schema.signature.uniforms[k]
    };
  }

  let attributes = {};
  for (let k of shader_schema.signature.attributes) {
    attributes[k] = {
      location: gl.getAttribLocation(program, k)
    };
  }

  return {
    program: program,
    uniforms: uniforms,
    attributes: attributes,
  };
}
