var Models = {
  "quad": new Float32Array([
    -1, -1,
    -1,  1,
     1, -1,
     1,  1
  ]),
};

function compadd(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function compmul(a, b) {
  return [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
}

// Generates a complex polynomial from its roots
function polyroots(roots) {
  var poly = [[1, 0]];
  poly[-1] = [0, 0]; // magic index makes for a cleaner multiplication loop
  for (var i = 0; i < roots.length; ++i) {
    poly.push([0, 0]);
    for (var j = i+1; j >= 0; --j) {
      poly[j] = compadd(poly[j-1], compmul(poly[j], compmul(roots[i], [-1, 0])));
    }
  }

  return poly;
}

// Takes the derivative of a complex polynomial
function polyD(poly) {
  var D = [];
  for (var i = 1; i < poly.length; ++i) {
    D.push(compmul([i, 0], poly[i]));
  }
  D.push([0, 0]);
  return D;
}


function xhrContent(xhr) {
  return xhr.response;
}

function makeShaderProgram(gl, roots, exponent, iterations) {
  return $.fetch("/shaders/frac_fragment.glsl").then(xhrContent).then(function(fragmentShaderSource) {
    return $.fetch("/shaders/frac_vertex.glsl").then(xhrContent).then(function(vertexShaderSource) {
      fragmentShaderSource = fragmentShaderSource.replace(/\{\{EXPONENT\}\}/g, ""+exponent).replace(/\{\{ITERATIONS\}\}/g, ""+iterations).replace(/\{\{NUMROOTS\}\}/g, ""+roots.length);

      var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentShaderSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(fragmentShader));
      }

      var vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexShaderSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(vertexShader));
      }

      var program = gl.createProgram();
      gl.attachShader(program, fragmentShader);
      gl.attachShader(program, vertexShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log(gl.getProgramInfoLog(program));
      }

      return program;
    });
  });
}


function Fractal(gl, model, settings, shaderProgram) {
  this.gl = gl;
  this.model = model;

  this.settings = settings;
  this.shaderProgram = shaderProgram;

  this.keys = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    zoomin: 0,
    zoomout: 0
  };
}

Fractal.prototype.draw = function() {
  var gl = this.gl;

  // Render the tile geometry
  gl.useProgram(this.shaderProgram);

  var vertexLocation = gl.getAttribLocation(this.shaderProgram, "a_vertex");
  var aspectLocation = gl.getUniformLocation(this.shaderProgram, "u_aspect");

  var polyLocation = gl.getUniformLocation(this.shaderProgram, "u_poly");
  var derivLocation = gl.getUniformLocation(this.shaderProgram, "u_deriv");
  var rootsLocation = gl.getUniformLocation(this.shaderProgram, "u_roots");
  var centerLocation = gl.getUniformLocation(this.shaderProgram, "u_center");
  var zoomLocation = gl.getUniformLocation(this.shaderProgram, "u_zoom");
  var brightnessLocation = gl.getUniformLocation(this.shaderProgram, "u_brightness");
  var colorLocation = gl.getUniformLocation(this.shaderProgram, "u_color");
  var rootRadiusLocation = gl.getUniformLocation(this.shaderProgram, "u_root_radius");
  var aLocation = gl.getUniformLocation(this.shaderProgram, "u_a");
  var epsLocation = gl.getUniformLocation(this.shaderProgram, "u_eps");

  var poly = polyroots(this.settings.roots);
  var deriv = polyD(poly);

  gl.uniform2fv(rootsLocation, Array.prototype.concat.apply([], this.settings.roots));
  gl.uniform2fv(polyLocation, Array.prototype.concat.apply([], poly));
  gl.uniform2fv(derivLocation, Array.prototype.concat.apply([], deriv));
  gl.uniform2fv(centerLocation, this.settings.center);
  gl.uniform1f(zoomLocation, this.settings.zoom);
  gl.uniform1f(brightnessLocation, this.settings.brightness);
  gl.uniform3fv(colorLocation, this.settings.color);
  gl.uniform1f(rootRadiusLocation, this.settings.root_radius);
  gl.uniform2fv(aLocation, this.settings.a);
  gl.uniform1f(epsLocation, this.settings.eps);

  gl.uniform1f(aspectLocation, canvas.width/canvas.height);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.model);
  gl.enableVertexAttribArray(vertexLocation);
  gl.vertexAttribPointer(vertexLocation, 2, gl.FLOAT, false, 0, 0);

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

Fractal.prototype.set = function(prop, value) {
  this.settings[prop] = value;
  this.redraw = true;
};

window.saveImage = function(filename) {
  // fs.writeFileSync(filename, new Buffer(canvas.toDataURL("image/png").replace(/^data:image\/\w+;base64,/, ""), "base64"));
}

window.onkeydown = function(ev) {
  switch (ev.keyCode) {
  case 65: world.keys.left = 1; break;
  case 68: world.keys.right = 1; break;
  case 87: world.keys.up = 1; break;
  case 83: world.keys.down = 1; break;
  case 16: world.keys.zoomin = 1; break;
  case 32: world.keys.zoomout = 1; break;
  }
}
window.onkeyup = function(ev) {
  switch (ev.keyCode) {
  case 65: world.keys.left = 0; break;
  case 68: world.keys.right = 0; break;
  case 87: world.keys.up = 0; break;
  case 83: world.keys.down = 0; break;
  case 16: world.keys.zoomin = 0; break;
  case 32: world.keys.zoomout = 0; break;
  }
}

$.fetch("/parameters.json", {responseType: "json"}).then(xhrContent).then(function(settings) {
  // Create a canvas
  var canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Get the WebGL context
  var gl = canvas.getContext("webgl", {
    antialias: true,
    preserveDrawingBuffer: true  // enable saving the canvas as an image.
  });

  // Load the surface geometry into GPU memory
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, Models["quad"], gl.STATIC_DRAW);

  makeShaderProgram(gl, settings.roots, settings.exponent, settings.iterations).then(function(program) {
    // Set up the fractal generator
    var world = new Fractal(gl, buffer, settings, program);
    window.world = world;

    requestAnimationFrame(function onAnimationFrame() {
      world.draw();
    });
  })
});
