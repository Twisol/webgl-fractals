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

function upload_uniforms(gl, shader, uniforms) {
  gl.useProgram(shader.program);

  for (const uniform_name in uniforms) {
    const {type, location} = shader.uniforms[uniform_name];
    gl["uniform"+type](location, uniforms[uniform_name]);
  }

  gl.useProgram(null);
};

function draw_fractal(gl, shader, mesh) {
/// Clear the canvas
  gl.clear(gl.COLOR_BUFFER_BIT);

/// Set up GL state
  // Load shader state
  gl.useProgram(shader.program);

  // Modify global vertex array state
  for (const attribute_name in mesh.attributes) {
    const {
      buffer,
      format: {components, type, stride, offset}
    } = mesh.attributes[attribute_name];

    const {location} = shader.attributes[attribute_name];

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, components, type, false, stride, offset);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

/// Draw using the current pipeline
  gl.drawArrays(mesh.primitive_type, 0, mesh.vertex_count);

/// Tear down GL state
  for (const attribute_name in mesh.attributes) {
    const {location} = shader.attributes[attribute_name];

    gl.disableVertexAttribArray(location);
  }

  gl.useProgram(null);
}


const FRACTAL_SHADER_SCHEMA = {
  vertex_source_path: "shaders/frac_vertex.glsl",
  fragment_source_path: "shaders/frac_fragment.glsl",

  signature: {
    constants: ["ITERATIONS", "NUMROOTS"],

    uniforms: {
      "u_aspect":       "1f",
      "u_roots":        "2fv",
      "u_colors":       "3fv",
      "u_numerator":    "2fv",
      "u_denominator":  "2fv",
      "u_epsilon":      "1f",
      "u_center":       "2fv",
      "u_zoom":         "1f",
      "u_brightness":   "1f",
      "u_root_radius":  "1f",
    },

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
    primitive_type: Models["quad"].primitive_type,
    vertex_count: Models["quad"].vertex_count,
    attributes: {},
  };
  for (let attribute_name in Models["quad"].attributes) {
    const attribute = Models["quad"].attributes[attribute_name];

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attribute.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    mesh.attributes[attribute_name] = {
      format: attribute.format,
      buffer: buffer,
    };
  }

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
      upload_uniforms(gl, shader, {
        "u_roots": Array.prototype.concat.apply([], settings.roots),
        "u_numerator": Array.prototype.concat.apply([], settings.numerator),
        "u_denominator": Array.prototype.concat.apply([], settings.denominator),
        "u_colors": Array.prototype.concat.apply([], settings.colors),
        "u_center": camera.offset,
        "u_zoom": camera.zoom,
        "u_brightness": settings.brightness,
        "u_root_radius": settings.root_radius,
        "u_epsilon": settings.eps,
        "u_aspect": canvas.width/canvas.height,
      });
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
