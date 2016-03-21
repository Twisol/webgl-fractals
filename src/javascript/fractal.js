import {preprocessPolynomial} from "./newton";
import * as Shader from "./shader";
import Models from "./models";


function update_settings(settings, keys) {
  let center = [settings.center[0], settings.center[1]];
  let zoom = settings.zoom;

  if (keys.up !== keys.down) {
    center[1] += (keys.up - keys.down)/(30*settings.zoom);
  }
  if (keys.right !== keys.left) {
    center[0] += (keys.right - keys.left)/(30*settings.zoom);
  }
  if (keys.zoomin !== keys.zoomout) {
    zoom *= Math.pow(0.990, keys.zoomin - keys.zoomout);
  }

  return {
    center: center,
    zoom: zoom,
    brightness: settings.brightness,
    root_radius: settings.root_radius,

    roots: settings.roots,
    numerator: settings.numerator,
    denominator: settings.denominator,
    colors: settings.colors,

    iterations: settings.iterations,
    eps: settings.eps,
  };
}

function upload_uniforms(gl, shader, settings) {
  gl.useProgram(shader.program);

  gl.uniform2fv(shader.locations["u_roots"], Array.prototype.concat.apply([], settings.roots));
  gl.uniform2fv(shader.locations["u_numerator"], Array.prototype.concat.apply([], settings.numerator));
  gl.uniform2fv(shader.locations["u_denominator"], Array.prototype.concat.apply([], settings.denominator));
  gl.uniform3fv(shader.locations["u_colors"], Array.prototype.concat.apply([], settings.colors));
  gl.uniform2fv(shader.locations["u_center"], settings.center);
  gl.uniform1f(shader.locations["u_zoom"], settings.zoom);
  gl.uniform1f(shader.locations["u_brightness"], settings.brightness);
  gl.uniform1f(shader.locations["u_root_radius"], settings.root_radius);
  gl.uniform1f(shader.locations["u_eps"], settings.eps);
  gl.uniform1f(shader.locations["u_aspect"], canvas.width/canvas.height);

  gl.useProgram(null);
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

function main(settingsJSON, base_shader_schema) {
/// Prepare the data input and processing layer
  $("#parameters").value = settingsJSON;

  let settings = (function() {
    const inputs = JSON.parse(settingsJSON);

    // Generate a rational function from the roots/multiplicities.
    const {numerator, denominator} = preprocessPolynomial(inputs.roots, inputs.multiplicities);

    return {
      center: inputs.center,
      zoom: inputs.zoom,
      brightness: inputs.brightness,
      root_radius: inputs.root_radius,

      roots: inputs.roots,
      colors: inputs.colors,
      numerator: numerator,
      denominator: denominator,

      iterations: inputs.iterations,
      eps: inputs.eps,
    };
  })();

  // Track the current down/up state of virtual controller keys
  const keys = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    zoomin: 0,
    zoomout: 0,
  };

/// Prepare the fractal visualization layer
  // Create a canvas
  const canvas = document.getElementById("canvas");

  // Get the WebGL context
  const gl = canvas.getContext("webgl", {
    antialias: false,
    depth: false,
    alpha: false,
    preserveDrawingBuffer: true,  // enable saving the canvas as an image.
  });

  // Load the surface geometry into GPU memory
  const mesh = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh);
  gl.bufferData(gl.ARRAY_BUFFER, Models.quad, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Configure our fractal shader
  let shader = Shader.compile(gl, Shader.apply_constants(base_shader_schema, {
    "ITERATIONS": settings.iterations,
    "NUMROOTS": settings.roots.length,
  }));

  // Flag to force redrawing
  let forceRedraw = false;

  // Draw handler
  function update_canvas() {
    const new_settings = update_settings(settings, keys);
    if (JSON.stringify(settings) !== JSON.stringify(new_settings)) {
      forceRedraw = true;
      settings = new_settings;
    }

    if (forceRedraw) {
      forceRedraw = false;
      upload_uniforms(gl, shader, settings);
      draw_fractal(gl, shader, mesh);
    }
  };

/// DEBUG: Allow access to the current settings from the debug console
  window.currentSettings = () => settings;

/// Set up event handlers
  // Keyboard event handlers
  const KEYMAP = {
    "87": "up",
    "83": "down",
    "65": "left",
    "68": "right",
    "16": "zoomin",
    "32": "zoomout",
  };
  canvas.addEventListener("keydown", function(ev) {
    if (KEYMAP[ev.keyCode] !== undefined) {
      keys[KEYMAP[ev.keyCode]] = 1;
    }
  });
  canvas.addEventListener("keyup", function(ev) {
    if (KEYMAP[ev.keyCode] !== undefined) {
      keys[KEYMAP[ev.keyCode]] = 0;
    }
  });

  // Frame event handler
  forceRedraw = true;
  requestAnimationFrame(function onAnimationFrame() {
    requestAnimationFrame(onAnimationFrame);
    update_canvas();
  });

  // Reconfiguration handler
  $("#parameters").addEventListener("input", function(ev) {
    let inputs;
    try {
      inputs = JSON.parse(ev.target.value);
    } catch (ex) {
      console.log("Invalid JSON");
      return;
    }

    if (inputs.roots.length != settings.roots.length
    || inputs.iterations != settings.iterations) {
      shader = Shader.compile(gl, Shader.apply_constants(base_shader_schema, {
        "ITERATIONS": inputs.iterations,
        "NUMROOTS": inputs.roots.length,
      }));
    }

    let numerator = settings.numerator;
    let denominator = settings.denominator;
    if (JSON.stringify(inputs.roots) !== JSON.stringify(settings.roots)
    ||  JSON.stringify(inputs.multiplicities) !== JSON.stringify(settings.multiplicities)) {
      ({numerator, denominator} = preprocessPolynomial(inputs.roots, inputs.multiplicities));
    }

    settings = {
      center: inputs.center,
      zoom: inputs.zoom,
      brightness: inputs.brightness,
      root_radius: inputs.root_radius,

      roots: inputs.roots,
      colors: inputs.colors,
      numerator: numerator,
      denominator: denominator,

      iterations: inputs.iterations,
      eps: inputs.eps,
    };
    forceRedraw = true;
  });
}


/*/
$.fetch("catalog.json").then(function(xhr) {
  let catalog = JSON.parse(xhr.response);
  let settingsJSON = JSON.stringify(catalog["metro"]);
  Shader.fetch(FRACTAL_SHADER_SCHEMA).then(function(base_shader_schema) {
    main(settingsJSON, base_shader_schema);
  });
});
/*/
$.fetch("parameters.json").then(function(xhr) {
  let settingsJSON = xhr.response
  Shader.fetch(FRACTAL_SHADER_SCHEMA).then(function(base_shader_schema) {
    main(settingsJSON, base_shader_schema);
  });
});
//*/
