let Models = {
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
  let D = [];
  for (let i = 1; i < poly.length; ++i) {
    D.push(compmul([i, 0], poly[i]));
  }
  D.push([0, 0]);
  return D;
}


function xhrContent(xhr) {
  return xhr.response;
}

function makeShaderProgram(gl, fragmentShaderSource, vertexShaderSource, roots, exponent, iterations) {
  fragmentShaderSource = fragmentShaderSource.replace(/\{\{ITERATIONS\}\}/g, ""+iterations).replace(/\{\{NUMROOTS\}\}/g, ""+roots.length);

  let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  let vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
  }

  let program = gl.createProgram();
  gl.attachShader(program, fragmentShader);
  gl.attachShader(program, vertexShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(program));
  }

  return program;
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
  let gl = this.gl;
  let shaderProgram = this.shaderProgram;

  // Render the tile geometry
  gl.useProgram(shaderProgram);

  let vertexLocation = gl.getAttribLocation(shaderProgram, "a_vertex");
  let aspectLocation = gl.getUniformLocation(shaderProgram, "u_aspect");

  let polyLocation = gl.getUniformLocation(shaderProgram, "u_poly");
  let derivLocation = gl.getUniformLocation(shaderProgram, "u_deriv");
  let rootsLocation = gl.getUniformLocation(shaderProgram, "u_roots");
  let centerLocation = gl.getUniformLocation(shaderProgram, "u_center");
  let zoomLocation = gl.getUniformLocation(shaderProgram, "u_zoom");
  let brightnessLocation = gl.getUniformLocation(shaderProgram, "u_brightness");
  let colorLocation = gl.getUniformLocation(shaderProgram, "u_color");
  let rootRadiusLocation = gl.getUniformLocation(shaderProgram, "u_root_radius");
  let aLocation = gl.getUniformLocation(shaderProgram, "u_a");
  let epsLocation = gl.getUniformLocation(shaderProgram, "u_eps");

  let poly = polyroots(this.settings.roots);
  let deriv = polyD(poly);

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
  $.fetch("/shaders/frac_fragment.glsl").then(xhrContent).then(function(fragmentShaderSource) {
    $.fetch("/shaders/frac_vertex.glsl").then(xhrContent).then(function(vertexShaderSource) {
      // Create a canvas
      let canvas = document.getElementById("canvas");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Get the WebGL context
      let gl = canvas.getContext("webgl", {
        antialias: true,
        preserveDrawingBuffer: true  // enable saving the canvas as an image.
      });

      // Load the surface geometry into GPU memory
      let buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, Models["quad"], gl.STATIC_DRAW);

      let program = makeShaderProgram(gl, fragmentShaderSource, vertexShaderSource, settings.roots, settings.exponent, settings.iterations);

      // Set up the fractal generator
      let world = new Fractal(gl, buffer, settings, program);
      window.world = world;

      requestAnimationFrame(function onAnimationFrame() {
        world.draw();
      });
    });
  });
});
