import {preprocessPolynomial} from "./newton";
import * as Shader from "./shader";
import Models from "./models";


function Fractal(settings) {
  this.settings = settings;
  this.forcedRedraw = false;
  this.numerator = null;
  this.denominator = null;
}

function update_world(world, keys) {
  let settings = world.settings;
  let shouldRedraw = world.forcedRedraw;

  let center = [settings.center[0], settings.center[1]];
  let zoom = settings.zoom;

  if (keys.up !== keys.down) {
    center[1] += (keys.up - keys.down)/(30*settings.zoom);
    shouldRedraw = true;
  }
  if (keys.right !== keys.left) {
    center[0] += (keys.right - keys.left)/(30*settings.zoom);
    shouldRedraw = true;
  }
  if (keys.zoomin !== keys.zoomout) {
    zoom *= Math.pow(0.990, keys.zoomin - keys.zoomout);
    shouldRedraw = true;
  }

  let new_world = new Fractal({
    center: center,
    zoom: zoom,
    brightness: settings.brightness,
    root_radius: settings.root_radius,

    roots: settings.roots,
    multiplicities: settings.multiplicities,
    colors: settings.colors,

    iterations: settings.iterations,
    eps: settings.eps,
  });
  new_world.forcedRedraw = shouldRedraw;
  new_world.numerator = world.numerator;
  new_world.denominator = world.denominator;
  return new_world;
}

function upload_uniforms(gl, shader, world) {
  gl.useProgram(shader.program);

  gl.uniform2fv(shader.locations["u_roots"], Array.prototype.concat.apply([], world.settings.roots));
  gl.uniform2fv(shader.locations["u_numerator"], Array.prototype.concat.apply([], world.numerator));
  gl.uniform2fv(shader.locations["u_denominator"], Array.prototype.concat.apply([], world.denominator));
  gl.uniform3fv(shader.locations["u_colors"], Array.prototype.concat.apply([], world.settings.colors));
  gl.uniform2fv(shader.locations["u_center"], world.settings.center);
  gl.uniform1f(shader.locations["u_zoom"], world.settings.zoom);
  gl.uniform1f(shader.locations["u_brightness"], world.settings.brightness);
  gl.uniform1f(shader.locations["u_root_radius"], world.settings.root_radius);
  gl.uniform1f(shader.locations["u_eps"], world.settings.eps);
  gl.uniform1f(shader.locations["u_aspect"], canvas.width/canvas.height);
};

function draw_fractal(gl, shader, mesh) {
/// Set up GL state
  // Load shader state
  gl.useProgram(shader.program);

  // Load array buffer state
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh);

  // Modify global vertex array state
  gl.enableVertexAttribArray(shader.locations["a_vertex"]);
  gl.vertexAttribPointer(shader.locations["a_vertex"], 2, gl.FLOAT, false, 0, 0);

/// Draw using the current pipeline
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

/// Tear down GL state
  gl.disableVertexAttribArray(shader.locations["a_vertex"]);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.useProgram(null);
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

// $.fetch("catalog.json").then(function(xhr) {
//   let catalog = JSON.parse(xhr.response);
//   let settings = JSON.parse(JSON.stringify(catalog["metro"]));
//   $("#parameters").value = JSON.stringify(settings);
$.fetch("parameters.json").then(function(xhr) {
  let settings = JSON.parse(xhr.response);
  $("#parameters").value = xhr.response;

  // Set up the fractal generator
  let world = new Fractal(settings);
  window.world = world;

  // Keep track of user input
  let keys = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    zoomin: 0,
    zoomout: 0,
  };

  Shader.fetch(FRACTAL_SHADER_SCHEMA).then(function(base_shader_schema) {
    // Create a canvas
    let canvas = document.getElementById("canvas");

    // Get the WebGL context
    let gl = canvas.getContext("webgl", {
      antialias: false,
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
      numerator: world.numerator,
      denominator: world.denominator,
    } = preprocessPolynomial(settings.roots, settings.multiplicities));

    world.forcedRedraw = true;
    requestAnimationFrame(function onAnimationFrame() {
      requestAnimationFrame(onAnimationFrame);

      world = update_world(world, keys);

      if (world.forcedRedraw) {
        upload_uniforms(gl, shader, world);
        draw_fractal(gl, shader, mesh);
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
          numerator: world.numerator,
          denominator: world.denominator,
        } = preprocessPolynomial(settings.roots, settings.multiplicities));
      }

      world.forcedRedraw = true;
      world.settings = settings;
    });

    canvas.addEventListener("keydown", function(ev) {
      switch (ev.keyCode) {
      case 65: keys.left = 1; break;
      case 68: keys.right = 1; break;
      case 87: keys.up = 1; break;
      case 83: keys.down = 1; break;
      case 16: keys.zoomin = 1; break;
      case 32: keys.zoomout = 1; break;
      }
    });
    canvas.addEventListener("keyup", function(ev) {
      switch (ev.keyCode) {
      case 65: keys.left = 0; break;
      case 68: keys.right = 0; break;
      case 87: keys.up = 0; break;
      case 83: keys.down = 0; break;
      case 16: keys.zoomin = 0; break;
      case 32: keys.zoomout = 0; break;
      }
    });
    canvas.addEventListener("click", function(ev) {
      canvas.focus();
    });
  });
});
