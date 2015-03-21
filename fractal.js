(function(window) {
  var sin = Math.sin;
  var cos = Math.cos;

  function matrixMultiply(matrices) {
    var R = identityMatrix();
    for (var i = 0; i < matrices.length; ++i) {
      var A = new Float32Array(R);
      var B = matrices[i];

      R[0]  =  A[0]*B[0] +  A[1]*B[4]  +  A[2]*B[8]  +  A[3]*B[12];
      R[1]  =  A[0]*B[1] +  A[1]*B[5]  +  A[2]*B[9]  +  A[3]*B[13];
      R[2]  =  A[0]*B[2] +  A[1]*B[6]  +  A[2]*B[10] +  A[3]*B[14];
      R[3]  =  A[0]*B[3] +  A[1]*B[7]  +  A[2]*B[11] +  A[3]*B[15];

      R[4]  =  A[4]*B[0] +  A[5]*B[4]  +  A[6]*B[8]  +  A[7]*B[12];
      R[5]  =  A[4]*B[1] +  A[5]*B[5]  +  A[6]*B[9]  +  A[7]*B[13];
      R[6]  =  A[4]*B[2] +  A[5]*B[6]  +  A[6]*B[10] +  A[7]*B[14];
      R[7]  =  A[4]*B[3] +  A[5]*B[7]  +  A[6]*B[11] +  A[7]*B[15];

      R[8]  =  A[8]*B[0] +  A[9]*B[4]  + A[10]*B[8]  + A[11]*B[12];
      R[9]  =  A[8]*B[1] +  A[9]*B[5]  + A[10]*B[9]  + A[11]*B[13];
      R[10] =  A[8]*B[2] +  A[9]*B[6]  + A[10]*B[10] + A[11]*B[14];
      R[11] =  A[8]*B[3] +  A[9]*B[7]  + A[10]*B[11] + A[11]*B[15];

      R[12] = A[12]*B[0] + A[13]*B[4]  + A[14]*B[8]  + A[15]*B[12];
      R[13] = A[12]*B[1] + A[13]*B[5]  + A[14]*B[9]  + A[15]*B[13];
      R[14] = A[12]*B[2] + A[13]*B[6]  + A[14]*B[10] + A[15]*B[14];
      R[15] = A[12]*B[3] + A[13]*B[7]  + A[14]*B[11] + A[15]*B[15];
    }

    return R;
  }

  function matrixTranspose(A) {
    return new Float32Array([
      A[0], A[4],  A[8], A[12],
      A[1], A[5],  A[9], A[13],
      A[2], A[6], A[10], A[14],
      A[3], A[7], A[11], A[15]
    ]);
  }

  function vectorMultiply(A, v) {
    return new Float32Array([
       A[0]*v[0] +  A[1]*v[1] +  A[2]*v[2] +  A[3]*v[3],
       A[4]*v[0] +  A[5]*v[1] +  A[6]*v[2] +  A[7]*v[3],
       A[8]*v[0] +  A[9]*v[1] + A[10]*v[2] + A[11]*v[3],
      A[12]*v[0] + A[13]*v[1] + A[14]*v[2] + A[15]*v[3]
    ]);
  }

  function identityMatrix() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  function scaleMatrix(x_scale, y_scale, z_scale) {
    return new Float32Array([
      x_scale,       0,       0, 0,
            0, y_scale,       0, 0,
            0,       0, z_scale, 0,
            0,       0,       0, 1
    ]);
  }

  function translationMatrix(x, y, z) {
    return new Float32Array([
      1, 0, 0, x,
      0, 1, 0, y,
      0, 0, 1, z,
      0, 0, 0, 1,
    ]);
  }

  function rotationZMatrix(angle) {
    return new Float32Array([
       cos(angle), sin(angle), 0, 0,
      -sin(angle), cos(angle), 0, 0,
                0,          0, 1, 0,
                0,          0, 0, 1
    ]);
  }

  function rotationYMatrix(angle) {
    return new Float32Array([
       cos(angle),           0, -sin(angle), 0,
                0,           1,           0, 0,
       sin(angle),           0,  cos(angle), 0,
                0,           0,           0, 1
    ]);
  }

  function TriangleList(vertices) {
    this.vertices = new Float32Array(vertices);
  }

  function TriangleStrip(vertices) {
    this.vertices = new Float32Array(vertices);
  }

  window.matrixMultiply = matrixMultiply;
  window.matrixTranspose = matrixTranspose;
  window.vectorMultiply = vectorMultiply;
  window.identityMatrix = identityMatrix;
  window.scaleMatrix = scaleMatrix;
  window.translationMatrix = translationMatrix;
  window.rotationZMatrix = rotationZMatrix;
  window.rotationYMatrix = rotationYMatrix;

  window.TriangleList = TriangleList;
  window.TriangleStrip = TriangleStrip;

  window.Models = {
    "tile": new TriangleStrip([
       0, 0, 0,
       0, 600, 0,
       800, 0, 0,
       800, 600, 0
    ])
  };
})(window);

(function(window) {
  var fs = require("fs");

  function makeShaderProgram(gl, resX, resY, resZ) {
    var fragmentShaderSource = fs.readFileSync("frac_fragment.glsl");
    var vertexShaderSource = fs.readFileSync("frac_vertex.glsl");

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    console.log(gl.getShaderInfoLog(fragmentShader));

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    //console.log(gl.getShaderInfoLog(vertexShader));

    var program = gl.createProgram();
    gl.attachShader(program, fragmentShader);
    gl.attachShader(program, vertexShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    return program;
  }

  // Create a canvas
  var canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  // Get the WebGL context
  var gl = canvas.getContext("webgl");
  //gl.enable(gl. CULL_FACE);
  window.gl = gl;

  // Load the paddle geometry into GPU memory
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, Models["tile"].vertices, gl.STATIC_DRAW);

  var shaderProgram = makeShaderProgram(gl);

  function Game(gl, model) {
    this.gl = gl;
    this.model = model;

    this.projection = matrixMultiply([
      new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 1,
      ]),
      scaleMatrix(1, -1, 1),
      scaleMatrix(2/800, 2/600, 1000),
    ]);

    this.cameraPosition = [400, 300, -500, 1];
    this.iterations = 50;

    this.keys = {
      left: 0,
      right: 0,
      up: 0,
      down: 0,
      forward: 0,
      backward: 0,
    };
  }

  Game.prototype.update = function() {
    this.iterations += 1;

    this.cameraPosition[0] += 5*(this.keys.right - this.keys.left);
    this.cameraPosition[1] += 5*(this.keys.down - this.keys.up);
    this.cameraPosition[2] += 5*(this.keys.forward - this.keys.backward);
  };

  document.body.onkeydown = function(ev) {
    if (ev.keyCode == 38 || ev.keyCode == 87) {
      world.keys.forward = 1;
    } else if (ev.keyCode == 40 || ev.keyCode == 83) {
      world.keys.backward = 1;
    } else if (ev.keyCode == 90) {
      world.keys.down = 1;
    } else if (ev.keyCode == 88) {
      world.keys.up = 1;
    } else if (ev.keyCode == 65) {
      world.keys.left = 1;
    } else if (ev.keyCode == 68) {
      world.keys.right = 1;
    }
  };

  document.body.onkeyup = function(ev) {
    if (ev.keyCode == 38 || ev.keyCode == 87) {
      world.keys.forward = 0;
    } else if (ev.keyCode == 40 || ev.keyCode == 83) {
      world.keys.backward = 0;
    } else if (ev.keyCode == 90) {
      world.keys.down = 0;
    } else if (ev.keyCode == 88) {
      world.keys.up = 0;
    } else if (ev.keyCode == 65) {
      world.keys.left = 0;
    } else if (ev.keyCode == 68) {
      world.keys.right = 0;
    }
  };

  Game.prototype.draw = function() {
    // Render the tile geometry
    gl.useProgram(shaderProgram);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var vertexLocation = gl.getAttribLocation(shaderProgram, "a_vertex");
    var iterationsLocation = gl.getUniformLocation(shaderProgram, "u_iterations");
    var modelLocation = gl.getUniformLocation(shaderProgram, "u_model");
    var viewLocation = gl.getUniformLocation(shaderProgram, "u_view");
    var projectionLocation = gl.getUniformLocation(shaderProgram, "u_projection");

    gl.bindBuffer(gl.ARRAY_BUFFER, this.model);
    gl.enableVertexAttribArray(vertexLocation);
    gl.vertexAttribPointer(vertexLocation, 3, gl.FLOAT, false, 0, 0);

    gl.uniform1i(iterationsLocation, this.iterations);
    gl.uniformMatrix4fv(projectionLocation, false, matrixTranspose(world.projection));
    gl.uniformMatrix4fv(viewLocation, false, matrixTranspose(translationMatrix(
      -this.cameraPosition[0],
      -this.cameraPosition[1],
      -this.cameraPosition[2]
    )));

    gl.uniformMatrix4fv(modelLocation, false, identityMatrix());
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  var world = new Game(gl, buffer);
  window.world = world;

  (function onAnimationFrame() {
    //requestAnimationFrame(onAnimationFrame);
    world.update();
    world.draw();
  })();
})(window);
