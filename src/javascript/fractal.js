import {preprocessPolynomial} from "./newton";
import * as Shader from "./shader";
import Models from "./models";


function Fractal(settings) {
  this.settings = settings;

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

Fractal.prototype.load_uniforms = function(gl, shader) {
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
};

Fractal.prototype.draw = function(gl, shader, mesh) {
  gl.useProgram(shader.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh);
  gl.enableVertexAttribArray(shader.locations["a_vertex"]);
  gl.vertexAttribPointer(shader.locations["a_vertex"], 2, gl.FLOAT, false, 0, 0);

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}


const FRACTAL_SHADER_SCHEMA = {
  vertex_source_path: "shaders/frac_vertex.glsl",
  fragment_source_path: "shaders/frac_fragment.glsl",

  signature: {
    constants: ["ITERATIONS", "NUMROOTS"],

    uniforms: [
      "u_aspect",
      "u_roots",
      "u_colors",
      "u_numerator",
      "u_denominator",
      "u_eps",
      "u_center",
      "u_zoom",
      "u_brightness",
      "u_root_radius",
    ],

    attributes: ["a_vertex"],
  },
};

const xhrContent = (xhr) => xhr.response;

// $.fetch("catalog.json").then(xhrContent).then(function(catalog) {
//  var settings = JSON.parse(JSON.stringify(catalog["metro"]));
$.fetch("parameters.json").then(xhrContent).then(function(parametersJSON) {
  let settings = JSON.parse(parametersJSON);
  $("#parameters").value = parametersJSON;

  Shader.fetch(FRACTAL_SHADER_SCHEMA).then(function(base_shader_schema) {
    // Create a canvas
    let canvas = document.getElementById("canvas");

    // Get the WebGL context
    let gl = canvas.getContext("webgl", {
      antialias: true,
      depth: false,
      alpha: false,
      preserveDrawingBuffer: true,  // enable saving the canvas as an image.
    });

    // Load the surface geometry into GPU memory
    let mesh = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh);
    gl.bufferData(gl.ARRAY_BUFFER, Models.quad, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    let shader = Shader.compile(gl, Shader.apply_constants(base_shader_schema, {
      "ITERATIONS": settings.iterations,
      "NUMROOTS": settings.roots.length,
    }));

    ({
      numerator: settings.numerator,
      denominator: settings.denominator,
    } = preprocessPolynomial(settings.roots, settings.multiplicities));

    // Set up the fractal generator
    let world = new Fractal(settings);
    window.world = world;

    world.forcedRedraw = true;
    requestAnimationFrame(function onAnimationFrame() {
      requestAnimationFrame(onAnimationFrame);

      let shouldRedraw = world.update();
      if (shouldRedraw) {
        world.load_uniforms(gl, shader);
        world.draw(gl, shader, mesh);
      }
    });

    $("#parameters").addEventListener("input", function(ev) {
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
        shader = Shader.compile(gl, Shader.apply_constants(base_shader_schema, {
          "ITERATIONS": settings.iterations,
          "NUMROOTS": settings.roots.length,
        }));
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
    });

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
  });
});
