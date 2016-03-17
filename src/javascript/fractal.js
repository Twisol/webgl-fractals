import {preprocessPolynomial} from "./newton";

let Models = {
  "quad": new Float32Array([
    -1, -1,
    -1,  1,
     1, -1,
     1,  1
  ]),
};


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

  return {
    program: program,
    locations: {
      "a_vertex": gl.getAttribLocation(program, "a_vertex"),
      "u_aspect": gl.getUniformLocation(program, "u_aspect"),

      "u_roots": gl.getUniformLocation(program, "u_roots"),
      "u_colors": gl.getUniformLocation(program, "u_colors"),
      "u_numerator": gl.getUniformLocation(program, "u_numerator"),
      "u_denominator": gl.getUniformLocation(program, "u_denominator"),
      "u_eps": gl.getUniformLocation(program, "u_eps"),

      "u_center": gl.getUniformLocation(program, "u_center"),
      "u_zoom": gl.getUniformLocation(program, "u_zoom"),
      "u_brightness": gl.getUniformLocation(program, "u_brightness"),
      "u_root_radius": gl.getUniformLocation(program, "u_root_radius"),
    },
  }
}


function Fractal(gl, model, settings, shader) {
  this.gl = gl;
  this.model = model;

  this.settings = settings;
  this.shader = shader;

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
  let shouldRedraw = false;

  if (this.forcedRedraw) {
    this.forcedRedraw = false;
    shouldRedraw = true;
  }
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
  let shader = this.shader;

  // Render the tile geometry
  gl.useProgram(shader.program);

  gl.uniform2fv(shader.locations["u_roots"], Array.prototype.concat.apply([], this.settings.roots));
  gl.uniform2fv(shader.locations["u_numerator"], Array.prototype.concat.apply([], this.settings.numerator));
  gl.uniform2fv(shader.locations["u_denominator"], Array.prototype.concat.apply([], this.settings.denominator));
  gl.uniform3fv(shader.locations["u_colors"], Array.prototype.concat.apply([], this.settings.colors));
  gl.uniform2fv(shader.locations["u_center"], this.settings.center);
  gl.uniform1f(shader.locations["u_zoom"], this.settings.zoom);
  gl.uniform1f(shader.locations["u_brightness"], this.settings.brightness);
  gl.uniform1f(shader.locations["u_root_radius"], this.settings.root_radius);
  gl.uniform1f(shader.locations["u_eps"], this.settings.eps);

  gl.uniform1f(shader.locations["u_aspect"], canvas.width/canvas.height);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.model);
  gl.enableVertexAttribArray(shader.locations["a_vertex"]);
  gl.vertexAttribPointer(shader.locations["a_vertex"], 2, gl.FLOAT, false, 0, 0);

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

  ({
    numerator: settings.numerator,
    denominator: settings.denominator,
  } = preprocessPolynomial(settings.roots, settings.multiplicities));

  $.fetch("shaders/frac_fragment.glsl").then(xhrContent).then(function(fragmentShaderSource) {
    $.fetch("shaders/frac_vertex.glsl").then(xhrContent).then(function(vertexShaderSource) {
      // Create a canvas
      let canvas = document.getElementById("canvas");
      // canvas.width = window.innerWidth;
      // canvas.height = window.innerHeight;

      // Get the WebGL context
      let gl = canvas.getContext("webgl", {
        antialias: true,
        depth: false,
        alpha: false,
        preserveDrawingBuffer: true,  // enable saving the canvas as an image.
      });

      // Load the surface geometry into GPU memory
      let buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, Models["quad"], gl.STATIC_DRAW);

      let shader = makeShaderProgram(gl, fragmentShaderSource, vertexShaderSource, settings.roots, settings.exponent, settings.iterations);

      // Set up the fractal generator
      let world = new Fractal(gl, buffer, settings, shader);
      window.world = world;

      world.forcedRedraw = true;
      requestAnimationFrame(function onAnimationFrame() {
        requestAnimationFrame(onAnimationFrame);

        let shouldRedraw = world.update();
        if (shouldRedraw) {
          world.draw();
        }
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
          world.shader = makeShaderProgram(gl, fragmentShaderSource, vertexShaderSource, settings.roots, settings.exponent, settings.iterations);
        }

        if (JSON.stringify(settings.roots) !== JSON.stringify(world.settings.roots)
        ||  JSON.stringify(settings.multiplicities) !== JSON.stringify(world.settings.multiplicities)) {
          console.log("Recreating polynomials");
          ({
            numerator: settings.numerator,
            denominator: settings.denominator,
          } = preprocessPolynomial(settings.roots, settings.multiplicities));
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
