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

function polyadd(p1, p2) {
  if (p1.length < p2.length) {
    let tmp = p1;
    p1 = p2;
    p2 = tmp;
  }
  // p1 is now at least as long as p2

  // Get the higher-order terms from p1 which aren't affected
  let p = p1.slice(0, p1.length - p2.length);
  p1 = p1.slice(p1.length - p2.length);

  // Sum the lower-order terms
  for (let i = 0; i < p1.length; i += 1) {
    p.push(compadd(p1[i], p2[i]));
  }

  return p;
}

function polymul(p1, p2) {
  let p = [];

  for (let i = 0; i <= Math.max(p1.length, p2.length); i += 1) {
  // For every term in the result polynomial
    let term = [0, 0];

    for (let a = 0; a < p1.length; a += 1) {
      let b = i - a;
      if (b < 0) {
        break;
      } else if (b >= p2.length) {
        continue;
      }

      term = compadd(term, compmul(p1[a], p2[b]));
    }

    p.push(term);
  }

  return p;
}

function getNumerator(roots) {
  let poly = [[1, 0]];
  for (let i = 0; i < roots.length; i += 1) {
    poly = polymul(poly, [[1, 0], compmul([-1, 0], roots[i])]);
  }
  return poly;
}

function getDenominator(roots, multiplicities) {
  let poly = [[0, 0]];
  for (let i = 0; i < roots.length; i += 1) {
    let term = [multiplicities[i]];
    for (let j = 0; j < roots.length; j += 1) {
      if (j !== i) {
        term = polymul(term, [[1, 0], compmul([-1, 0], roots[j])]);
      }
    }
    poly = polyadd(poly, term);
  }
  return poly;
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

  this.forcedRedraw = false;
  this.keys = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    zoomin: 0,
    zoomout: 0
  };
}

Fractal.prototype.update = function() {
  let shouldRedraw = this.forcedRedraw;
  this.forcedRedraw = false;

  if (this.keys.up - this.keys.down != 0) {
    this.settings.center[1] += (this.keys.up - this.keys.down)/(30*this.settings.zoom);
    shouldRedraw = true;
  }
  if (this.keys.right - this.keys.left != 0) {
    this.settings.center[0] += (this.keys.right - this.keys.left)/(30*this.settings.zoom);
    shouldRedraw = true;
  }
  if (this.keys.zoomin - this.keys.zoomout != 0) {
    this.settings.zoom *= Math.pow(0.990, this.keys.zoomin - this.keys.zoomout);
    shouldRedraw = true;
  }

  return shouldRedraw;
};

Fractal.prototype.draw = function() {
  let gl = this.gl;
  let shaderProgram = this.shaderProgram;

  // Render the tile geometry
  gl.useProgram(shaderProgram);

  let vertexLocation = gl.getAttribLocation(shaderProgram, "a_vertex");
  let aspectLocation = gl.getUniformLocation(shaderProgram, "u_aspect");

  let rootsLocation = gl.getUniformLocation(shaderProgram, "u_roots");
  let numeratorLocation = gl.getUniformLocation(shaderProgram, "u_numerator");
  let denominatorLocation = gl.getUniformLocation(shaderProgram, "u_denominator");
  let colorsLocation = gl.getUniformLocation(shaderProgram, "u_colors");
  let centerLocation = gl.getUniformLocation(shaderProgram, "u_center");
  let zoomLocation = gl.getUniformLocation(shaderProgram, "u_zoom");
  let brightnessLocation = gl.getUniformLocation(shaderProgram, "u_brightness");
  let rootRadiusLocation = gl.getUniformLocation(shaderProgram, "u_root_radius");
  let epsLocation = gl.getUniformLocation(shaderProgram, "u_eps");

  gl.uniform2fv(rootsLocation, Array.prototype.concat.apply([], this.settings.roots));
  gl.uniform2fv(numeratorLocation, Array.prototype.concat.apply([], this.settings.numerator));
  gl.uniform2fv(denominatorLocation, Array.prototype.concat.apply([], this.settings.denominator));
  gl.uniform3fv(colorsLocation, Array.prototype.concat.apply([], this.settings.colors));
  gl.uniform2fv(centerLocation, this.settings.center);
  gl.uniform1f(zoomLocation, this.settings.zoom);
  gl.uniform1f(brightnessLocation, this.settings.brightness);
  gl.uniform1f(rootRadiusLocation, this.settings.root_radius);
  gl.uniform1f(epsLocation, this.settings.eps);

  gl.uniform1f(aspectLocation, canvas.width/canvas.height);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.model);
  gl.enableVertexAttribArray(vertexLocation);
  gl.vertexAttribPointer(vertexLocation, 2, gl.FLOAT, false, 0, 0);

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

canvas.tabIndex = 1;
canvas.addEventListener("keydown", function(ev) {
  switch (ev.keyCode) {
  case 65: world.keys.left = 1; break;
  case 68: world.keys.right = 1; break;
  case 87: world.keys.up = 1; break;
  case 83: world.keys.down = 1; break;
  case 16: world.keys.zoomin = 1; break;
  case 32: world.keys.zoomout = 1; break;
  }
});
canvas.addEventListener("keyup", function(ev) {
  switch (ev.keyCode) {
  case 65: world.keys.left = 0; break;
  case 68: world.keys.right = 0; break;
  case 87: world.keys.up = 0; break;
  case 83: world.keys.down = 0; break;
  case 16: world.keys.zoomin = 0; break;
  case 32: world.keys.zoomout = 0; break;
  }
});
canvas.addEventListener("click", function(ev) {
  canvas.focus();
});

// $.fetch("catalog.json", {responseType: "json"}).then(xhrContent).then(function(catalog) {
//  var settings = JSON.parse(JSON.stringify(catalog["metro"]));
$.fetch("parameters.json").then(xhrContent).then(function(parametersJSON) {
  let settings = JSON.parse(parametersJSON);
  $("#parameters").value = parametersJSON;

  settings.numerator = getNumerator(settings.roots);
  settings.denominator = getDenominator(settings.roots, settings.multiplicities);

  $.fetch("shaders/frac_fragment.glsl").then(xhrContent).then(function(fragmentShaderSource) {
    $.fetch("shaders/frac_vertex.glsl").then(xhrContent).then(function(vertexShaderSource) {
      // Create a canvas
      let canvas = document.getElementById("canvas");
      // canvas.width = window.innerWidth;
      // canvas.height = window.innerHeight;

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

      world.forcedRedraw = true;
      requestAnimationFrame(function onAnimationFrame() {
        if (world.update()) {
          world.draw();
        }

        requestAnimationFrame(onAnimationFrame);
      });

      $("#parameters").oninput = function(ev) {
        let settings;
        try {
          settings = JSON.parse(ev.target.value);
        } catch (ex) {
          console.log("Invalid JSON");
          return;
        }

        if (settings.roots.length != world.settings.roots.length
        || settings.iterations != world.settings.iterations) {
          console.log("Recreating shader");
          world.shaderProgram = makeShaderProgram(gl, fragmentShaderSource, vertexShaderSource, settings.roots, settings.exponent, settings.iterations);
        }

        if (JSON.stringify(settings.roots) !== JSON.stringify(world.settings.roots)
        ||  JSON.stringify(settings.multiplicities) !== JSON.stringify(world.settings.multiplicities)) {
          console.log("Recreating polynomials");
          settings.numerator = getNumerator(settings.roots);
          settings.denominator = getDenominator(settings.roots, settings.multiplicities);
        } else {
          settings.numerator = world.settings.numerator;
          settings.denominator = world.settings.denominator;
        }

        world.forcedRedraw = true;
        world.settings = settings;
      };
    });
  });
});
