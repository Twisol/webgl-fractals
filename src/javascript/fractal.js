import {preprocessPolynomial} from "./newton";
import * as Shader from "./shader";
import Models from "./models";


function update_camera(camera, keys) {
  let {offset: [xoff, yoff], zoom} = camera;

  if (keys.up !== keys.down) {
    yoff += (keys.up - keys.down)/(30*zoom);
  }
  if (keys.right !== keys.left) {
    xoff += (keys.right - keys.left)/(30*zoom);
  }
  if (keys.zoomin !== keys.zoomout) {
    zoom *= Math.pow(0.990, keys.zoomin - keys.zoomout);
  }

  return {offset: [xoff, yoff], zoom};
}

function upload_uniforms(gl, shader, settings, camera) {
  gl.useProgram(shader.program);

  gl.uniform2fv(shader.locations["u_roots"], Array.prototype.concat.apply([], settings.roots));
  gl.uniform2fv(shader.locations["u_numerator"], Array.prototype.concat.apply([], settings.numerator));
  gl.uniform2fv(shader.locations["u_denominator"], Array.prototype.concat.apply([], settings.denominator));
  gl.uniform3fv(shader.locations["u_colors"], Array.prototype.concat.apply([], settings.colors));
  gl.uniform2fv(shader.locations["u_center"], camera.offset);
  gl.uniform1f(shader.locations["u_zoom"], camera.zoom);
  gl.uniform1f(shader.locations["u_brightness"], settings.brightness);
  gl.uniform1f(shader.locations["u_root_radius"], settings.root_radius);
  gl.uniform1f(shader.locations["u_epsilon"], settings.eps);
  gl.uniform1f(shader.locations["u_aspect"], canvas.width/canvas.height);

  gl.useProgram(null);
};

function draw_fractal(gl, shader, mesh) {
  const _GL = window.WebGLRenderingContext;

/// Set up GL state
  // Load shader state
  gl.useProgram(shader.program);

  // Load array buffer state
  gl.bindBuffer(_GL.ARRAY_BUFFER, mesh.buffer);

  // Modify global vertex array state
  if ("position" in mesh.format) {
    const attr = mesh.format.position;
    gl.enableVertexAttribArray(shader.locations["a_vertex"]);
    gl.vertexAttribPointer(shader.locations["a_vertex"], attr.components, attr.type, false, attr.stride, attr.offset);
  }

/// Draw using the current pipeline
  gl.clear(_GL.COLOR_BUFFER_BIT);
  gl.drawArrays(mesh.primitive_type, 0, mesh.vertex_count);

/// Tear down GL state
  gl.disableVertexAttribArray(shader.locations["a_vertex"]);
  gl.bindBuffer(_GL.ARRAY_BUFFER, null);
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
      "u_epsilon",
      "u_center",
      "u_zoom",
      "u_brightness",
      "u_root_radius",
    ],

    attributes: ["a_vertex"],
  },
};

function main(inputs, base_shader_schema) {
/// Prepare the data input and processing layer
  let settings = (function() {
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

  let camera = {
    offset: [settings.center[0], settings.center[1]],
    zoom: settings.zoom,
  };

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
  const mesh = {
    primitive_type: Models.quad.primitive_type,
    format: Models.quad.format,
    vertex_count: Models.quad.vertex_count,
    buffer: gl.createBuffer(),
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, Models.quad.vertices, gl.STATIC_DRAW);
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
    const new_camera = update_camera(camera, keys);
    if (JSON.stringify(new_camera) !== JSON.stringify(camera)) {
      forceRedraw = true;
      camera = new_camera;
    }

    if (forceRedraw) {
      forceRedraw = false;
      upload_uniforms(gl, shader, settings, camera);
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
  function recomputeSettings(inputs) {
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
    camera = {
      offset: [settings.center[0], settings.center[1]],
      zoom: settings.zoom,
    };
    forceRedraw = true;
  }

  $("#parameters").addEventListener("input", function(ev) {
    let inputs;
    try {
      inputs = JSON.parse(ev.target.value);
    } catch (ex) {
      console.log("Invalid JSON");
      return;
    }

    recomputeSettings(inputs);
  });

  return {
    recomputeSettings: recomputeSettings,
  };
}


$.fetch("catalog.json").then(function(xhr) {
  Shader.fetch(FRACTAL_SHADER_SCHEMA).then(function(base_shader_schema) {
    let catalog = JSON.parse(xhr.response);
    let catalogEl = $("#catalog");
    for (let name in catalog) {
      let optionEl = document.createElement("option");
      optionEl.value = name;
      optionEl.textContent = name;
      catalogEl.appendChild(optionEl);
    }

    let controller = main(catalog["iridescence"], base_shader_schema);

    $("#parameters").value = JSON.stringify(catalog["iridescence"], undefined, 2);
    catalogEl.value = "iridescence";

    catalogEl.addEventListener("change", function(ev) {
      $("#parameters").value = JSON.stringify(catalog[ev.target.value], undefined, 2);
      controller.recomputeSettings(catalog[ev.target.value]);
    });
  });
});
