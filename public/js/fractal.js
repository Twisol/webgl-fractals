(function(window) {
  var fs = require("fs");

  var Models = {
    "quad": new Float32Array([
      -1, -1,
      -1,  1,
       1, -1,
       1,  1
    ])
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
    var D = [];
    for (var i = 1; i < poly.length; ++i) {
      D.push(compmul([i, 0], poly[i]));
    }
    D.push([0, 0]);
    return D;
  }

  function makeShaderProgram(gl, roots, exponent, iterations) {
    var fragmentShaderSource = fs.readFileSync("public/shaders/frac_fragment.glsl", {encoding: "utf-8"});
    var vertexShaderSource = fs.readFileSync("public/shaders/frac_vertex.glsl", {encoding: "utf-8"});

    fragmentShaderSource = fragmentShaderSource.replace(/\{\{EXPONENT\}\}/g, ""+exponent).replace(/\{\{ITERATIONS\}\}/g, ""+iterations).replace(/\{\{NUMROOTS\}\}/g, ""+roots.length);

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(fragmentShader));
    }

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(vertexShader));
    }

    var program = gl.createProgram();
    gl.attachShader(program, fragmentShader);
    gl.attachShader(program, vertexShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.log(gl.getProgramInfoLog(program));
    }

    return program;
  }

  // Create a canvas
  var canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Get the WebGL context
  var gl = canvas.getContext("webgl", {
    antialias: true,
    preserveDrawingBuffer: true  // enable saving the canvas as an image.
  });

  // Load the surface geometry into GPU memory
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, Models["quad"], gl.STATIC_DRAW);

  var settings = JSON.parse(fs.readFileSync("public/parameters.json"));
  var shaderProgram = makeShaderProgram(gl, settings.roots, settings.exponent, settings.iterations);

  function Fractal(gl, model, settings) {
    this.gl = gl;
    this.model = model;

    this.redraw = true;
    this.settings = settings;
    this.lastset = fs.statSync("public/parameters.json").mtime

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
    if (fs.statSync("public/parameters.json").mtime > this.lastset) {
      this.settings = JSON.parse(fs.readFileSync("public/parameters.json"));
      this.lastset = fs.statSync("public/parameters.json").mtime;
      this.redraw = true;
    }
    if (!this.redraw) {
      if (this.keys.up - this.keys.down != 0) {
        this.settings.center[1] += (this.keys.up - this.keys.down)/(30*this.settings.zoom);
        this.redraw = true;
      }
      if (this.keys.right - this.keys.left != 0) {
        this.settings.center[0] += (this.keys.right - this.keys.left)/(30*this.settings.zoom);
        this.redraw = true;
      }
      if (this.keys.zoomin - this.keys.zoomout != 0) {
        this.settings.zoom *= Math.pow(0.990, this.keys.zoomin - this.keys.zoomout);
        this.redraw = true;
      }
    }
  };

  Fractal.prototype.draw = function() {
    var gl = this.gl;

    // Render the tile geometry
    gl.useProgram(shaderProgram);

    var vertexLocation = gl.getAttribLocation(shaderProgram, "a_vertex");
    var aspectLocation = gl.getUniformLocation(shaderProgram, "u_aspect");

    var polyLocation = gl.getUniformLocation(shaderProgram, "u_poly");
    var derivLocation = gl.getUniformLocation(shaderProgram, "u_deriv");
    var rootsLocation = gl.getUniformLocation(shaderProgram, "u_roots");
    var centerLocation = gl.getUniformLocation(shaderProgram, "u_center");
    var zoomLocation = gl.getUniformLocation(shaderProgram, "u_zoom");
    var brightnessLocation = gl.getUniformLocation(shaderProgram, "u_brightness");
    var colorLocation = gl.getUniformLocation(shaderProgram, "u_color");
    var rootRadiusLocation = gl.getUniformLocation(shaderProgram, "u_root_radius");
    var aLocation = gl.getUniformLocation(shaderProgram, "u_a");
    var epsLocation = gl.getUniformLocation(shaderProgram, "u_eps");

    var poly = polyroots(this.settings.roots);
    var deriv = polyD(poly);

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
    this.redraw = true;
  };

  var world = new Fractal(gl, buffer, settings);

  window.world = world;
  window.saveImage = function(filename) {
    fs.writeFileSync(filename, new Buffer(canvas.toDataURL("image/png").replace(/^data:image\/\w+;base64,/, ""), "base64"));
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

  requestAnimationFrame(function onAnimationFrame() {
    requestAnimationFrame(onAnimationFrame);
    world.update();
    if (world.redraw) {
      world.draw();
      world.redraw = false;
    }
  });
})(window);
