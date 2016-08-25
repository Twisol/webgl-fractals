import {preprocessPolynomial} from "./newton";
import * as Shader from "./shader";
import Models from "./models";
import Rx from "rx";


Rx.Observable.prototype.sampleLast = function(sampler$, default_value) {
  if (!Rx.Observable.isObservable(sample)) {
    sampler$ = Rx.Observable.interval(sampler);
  }

  return this
    .map(x =>
      Rx.Observable
        .combineLatest(Rx.Observable.just(x), sampler$)
        .map(([x, _]) => x)
    )
    .switch();
};


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

function initialize_gl() {
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

  return {
    gl: gl,
    canvas: canvas,
    mesh: mesh,
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
  const keydown$ = Rx.Observable.fromEvent(canvas, "keydown").pluck("keyCode");
  const keyup$ = Rx.Observable.fromEvent(canvas, "keyup").pluck("keyCode");
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
    .map(([zoomin, zoomout]) => zoomin - zoomout)
    .distinctUntilChanged();
  const horizontal_pan$ = Rx.Observable
    .combineLatest(right$, left$)
    .map(([right, left]) => right - left)
    .distinctUntilChanged();
  const vertical_pan$ = Rx.Observable
    .combineLatest(up$, down$)
    .map(([up, down]) => up - down)
    .distinctUntilChanged();

  const camera_velocity$ = Rx.Observable
    .combineLatest(zoom$, vertical_pan$, horizontal_pan$)
    .map(([zoom, vertical_pan, horizontal_pan]) => ({zoom, vertical_pan, horizontal_pan}));


  // Only when updated from the dropdown, replace the parameter text box
  catalog_names$.forEach(name => {
    $("#parameters").value = JSON.stringify(catalog[name], undefined, 2);
  });

  return {
    parameters: parameters$,
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
  const {catalog, base_shader_schema} = resources;
  const controller = initialize_gl();

  const DEFAULT_CATALOG_NAME = "iridescence";
  const {
    parameters: parameters$,
    camera_velocity: camera_velocity$,
  } = interact_with_user(catalog, DEFAULT_CATALOG_NAME);

  // Produce a shader object from the parameters
  const shader$ = parameters$.distinctUntilChanged(undefined, (a, b) => {
    return a.roots.length === b.roots.length && a.iterations === b.iterations
  }).map(params => {
    const shader_schema = Shader.apply_constants(base_shader_schema, {
      "ITERATIONS": params.iterations,
      "NUMROOTS": params.roots.length,
    });
    return Shader.compile(controller.gl, shader_schema);
  });

  // Produce a camera object from the parameters
  const camera$ = parameters$.map(params => ({
    offset: [params.center[0], params.center[1]],
    zoom: params.zoom,
  })).distinctUntilChanged(undefined, (a, b) => {
    return JSON.stringify(a) === JSON.stringify(b);
  }).flatMapLatest(camera => {
    const sampler$ = Rx.Observable.interval(20);
    return camera_velocity$
      .sampleLast(20)
      .scan((camera, {zoom, vertical_pan, horizontal_pan}) => {
        const y_offset = vertical_pan/(30*camera.zoom);
        const x_offset = horizontal_pan/(30*camera.zoom);
        const zoom_multiplier = Math.pow(0.990, zoom);

        return {
          offset: [camera.offset[0]+x_offset, camera.offset[1]+y_offset],
          zoom: camera.zoom*zoom_multiplier,
        };
      }, camera)
      .startWith(camera)
      .distinctUntilChanged(undefined, (a, b) => {
        return JSON.stringify(a) === JSON.stringify(b);
      });
  });

  // Compute the polynomial from the parameters
  const polynomial$ = parameters$.distinctUntilChanged(undefined, (a, b) => {
    return (
        JSON.stringify(a.roots) === JSON.stringify(b.roots)
      && JSON.stringify(a.multiplicities) === JSON.stringify(b.multiplicities)
    );
  }).map(params => preprocessPolynomial(params.roots, params.multiplicities));

  let renderArgs = null;
  function onAnimationFrame() {
    const [params, shader, polynomial, camera] = renderArgs;
    renderArgs = null;

    upload_uniforms(controller.gl, shader, {
      "u_roots": Array.prototype.concat.apply([], params.roots),
      "u_numerator": Array.prototype.concat.apply([], polynomial.numerator),
      "u_denominator": Array.prototype.concat.apply([], polynomial.denominator),
      "u_colors": Array.prototype.concat.apply([], params.colors),
      "u_center": camera.offset,
      "u_zoom": camera.zoom,
      "u_brightness": params.brightness,
      "u_root_radius": params.root_radius,
      "u_epsilon": params.eps,
      "u_aspect": controller.canvas.width/controller.canvas.height,
    });
    draw_fractal(controller.gl, shader, controller.mesh);
  }

  Rx.Observable
    .combineLatest(parameters$, shader$, polynomial$, camera$)
    .forEach(([params, shader, polynomial, camera]) => {
      if (renderArgs === null) {
        requestAnimationFrame(onAnimationFrame);
      }
      renderArgs = [params, shader, polynomial, camera];
    });
});
