import {preprocessPolynomial} from "./newton";
import * as Shader from "./shader";
import Models from "./models";
import Rx from "rx";

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

function load_mesh(gl, model) {
  const mesh = {
    primitive_type: model.primitive_type,
    vertex_count: model.vertex_count,
    attributes: {},
  };

  for (let attribute_name in model.attributes) {
    const attribute = model.attributes[attribute_name];

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attribute.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    mesh.attributes[attribute_name] = {
      format: attribute.format,
      buffer: buffer,
    };
  }

  return mesh;
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
  const mesh = load_mesh(gl, Models["quad"]);

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

  return {
    recomputeSettings: recomputeSettings,
  };
}


function interact_with_user(catalog, default_catalog_name) {
  const canvas_el = $("#canvas");

  const catalog_el = $("#catalog");
  for (const name in catalog) {
    const option_el = document.createElement("option");
    option_el.value = name;
    option_el.textContent = name;
    catalog_el.appendChild(option_el);
  }
  catalog_el.value = default_catalog_name;


  const catalog_names$ = Rx.Observable.merge(
    // Default
    Rx.Observable.just(default_catalog_name),

    // User provided
    Rx.Observable.fromEvent(catalog_el, "change").map(ev => ev.target.value)
  );

  const parameters$ = Rx.Observable.merge(
    // Changed via dropdown
    catalog_names$.map(name => catalog[name]),

    // Changed via text input
    Rx.Observable.fromEvent($("#parameters"), "input").concatMap(ev => {
      try {
        return Rx.Observable.just(JSON.parse(ev.target.value));
      } catch (ex) {
        console.log("Invalid JSON");
        return Rx.Observable.empty();
      }
    })
  );

  // Camera controls
  const keydown$ = Rx.Observable.fromEvent(canvas, "keydown").map(ev => ev.keyCode);
  const keyup$ = Rx.Observable.fromEvent(canvas, "keyup").map(ev => ev.keyCode);
  const zoomin$ = Rx.Observable.merge(
    keydown$.filter(key => key == 16).map(() => 1),
    keyup$.filter(key => key == 16).map(() => 0)
  ).startWith(0);
  const zoomout$ = Rx.Observable.merge(
    keydown$.filter(key => key == 32).map(() => 1),
    keyup$.filter(key => key == 32).map(() => 0)
  ).startWith(0);
  const up$ = Rx.Observable.merge(
    keydown$.filter(key => key == 87).map(() => 1),
    keyup$.filter(key => key == 87).map(() => 0)
  ).startWith(0);
  const down$ = Rx.Observable.merge(
    keydown$.filter(key => key == 83).map(() => 1),
    keyup$.filter(key => key == 83).map(() => 0)
  ).startWith(0);
  const left$ = Rx.Observable.merge(
    keydown$.filter(key => key == 65).map(() => 1),
    keyup$.filter(key => key == 65).map(() => 0)
  ).startWith(0);
  const right$ = Rx.Observable.merge(
    keydown$.filter(key => key == 68).map(() => 1),
    keyup$.filter(key => key == 68).map(() => 0)
  ).startWith(0);

  const zoom$ = Rx.Observable
    .combineLatest(zoomin$, zoomout$)
    .map(([zoomin, zoomout]) => zoomin - zoomout);
  const horizontal_pan$ = Rx.Observable
    .combineLatest(right$, left$)
    .map(([right, left]) => right - left);
  const vertical_pan$ = Rx.Observable
    .combineLatest(up$, down$)
    .map(([up, down]) => up - down);

  const camera_velocity$ = Rx.Observable
    .combineLatest(zoom$, vertical_pan$, horizontal_pan$)
    .map(([zoom, vertical_pan, horizontal_pan]) => ({zoom, vertical_pan, horizontal_pan}));


  // Only when updated from the dropdown, replace the parameter text box
  catalog_names$.forEach(name => {
    $("#parameters").value = JSON.stringify(catalog[name], undefined, 2);
  });

  return {
    parameters: parameters$,
    catalog_names: catalog_names$,
    camera_velocity: camera_velocity$,
  };
}


function load_resources() {
  const catalog_xhr$ = $.fetch("catalog.json");
  const base_shader_schema$ = Shader.fetch(FRACTAL_SHADER_SCHEMA);

  return new Promise((resolve, reject) => {
    catalog_xhr$.then(catalog_xhr => {
      base_shader_schema$.then(base_shader_schema => {
        resolve({
          catalog: JSON.parse(catalog_xhr.response),
          base_shader_schema: base_shader_schema
        });
      });
    });
  });
}

load_resources().then(resources => {
  const DEFAULT_CATALOG_NAME = "iridescence";

  const {catalog, base_shader_schema} = resources;
  const controller = main(catalog[DEFAULT_CATALOG_NAME], base_shader_schema);

  const {
    parameters: parameters$,
    catalog_names: catalog_names$,
    camera_velocity: camera_velocity$,
  } = interact_with_user(catalog, DEFAULT_CATALOG_NAME);

  // Produce a camera object from the parameters
  const camera$ = parameters$.map(params => ({
    offset: [params.center[0], params.center[1]],
    zoom: params.zoom,
  })).flatMapLatest(camera => {
    return Rx.Observable.combineLatest(
      camera_velocity$,
      Rx.Observable.interval(50)
    ).map(([x, _]) => x)
    .scan((camera, {zoom, vertical_pan, horizontal_pan}) => {
      const yoff = vertical_pan/(30*camera.zoom);
      const xoff = horizontal_pan/(30*camera.zoom);
      const zoom_multiplier = Math.pow(0.990, zoom);

      return {
        offset: [camera.offset[0]+xoff, camera.offset[1]+yoff],
        zoom: camera.zoom*zoom_multiplier,
      };
    }, camera);
  });

  // Compute the polynomial from the parameters
  const polynomial$ = parameters$.distinctUntilChanged(undefined, (a, b) => (
    JSON.stringify(a.roots) === JSON.stringify(b.roots)
    && JSON.stringify(a.multiplicities) === JSON.stringify(b.multiplicities)
  )).map(params => preprocessPolynomial(params.roots, params.multiplicities));

  camera$.forEach(x => console.log(JSON.stringify(x)));


  // Whenever the parameters change, re-generate the fractal
  parameters$.forEach(params => {
    controller.recomputeSettings(params);
  });
});
