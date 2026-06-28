const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector("#site-nav");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function createShaderBackground() {
  if (reduceMotion) return;

  const layer = document.createElement("div");
  layer.className = "shader-background";
  layer.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  layer.appendChild(canvas);
  document.body.prepend(layer);

  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    layer.remove();
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    varying vec2 v_texCoord;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = v_texCoord;
      uv.x *= u_resolution.x / u_resolution.y;

      float t = u_time * 0.045;
      mat2 rot = mat2(cos(t), -sin(t), sin(t), cos(t));
      uv = rot * (uv - vec2(0.5 * u_resolution.x / u_resolution.y, 0.5)) + vec2(0.5);

      float stars = 0.0;
      for (float i = 1.0; i < 4.0; i++) {
        vec2 gridUv = uv * (42.0 * i);
        vec2 id = floor(gridUv);
        vec2 f = fract(gridUv) - 0.5;
        float n = hash(id);
        if (n > 0.982) {
          float twinkle = sin(u_time * 1.8 + n * 6.28) * 0.5 + 0.5;
          float size = 0.045 + 0.08 * n;
          stars += smoothstep(size, 0.0, length(f)) * twinkle;
        }
      }

      vec2 mouse = u_mouse / u_resolution;
      float mouseGlow = 1.0 - smoothstep(0.0, 0.55, length(v_texCoord - mouse));
      float horizon = smoothstep(0.9, 0.15, v_texCoord.y);

      vec3 color = vec3(0.01, 0.014, 0.016);
      color += vec3(0.0, 0.22, 0.24) * mouseGlow * 0.32;
      color += vec3(0.0, 0.11, 0.13) * horizon * 0.28;
      color = mix(color, vec3(0.92, 1.0, 1.0), stars * 0.75);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    time: gl.getUniformLocation(program, "u_time"),
    resolution: gl.getUniformLocation(program, "u_resolution"),
    mouse: gl.getUniformLocation(program, "u_mouse"),
  };
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function syncSize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  window.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = (1 - (event.clientY - rect.top) / rect.height) * canvas.height;
  }, { passive: true });

  if ("ResizeObserver" in window) {
    new ResizeObserver(syncSize).observe(canvas);
  }
  syncSize();

  function render(time) {
    syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, time * 0.001);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function createPointerMotion() {
  if (reduceMotion) return;

  const elements = [...document.querySelectorAll(".button, .hero-visual, .app-symbol, .app-card, .principle-card, .info-panel")];
  if (!elements.length) return;

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let frame = 0;

  window.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });

  function update() {
    frame = 0;
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distanceX = (pointerX - centerX) / Math.max(window.innerWidth, 1);
      const distanceY = (pointerY - centerY) / Math.max(window.innerHeight, 1);
      const strength = element.classList.contains("button") ? 10 : 16;
      element.style.setProperty("--motion-x", `${(distanceX * strength).toFixed(2)}px`);
      element.style.setProperty("--motion-y", `${(distanceY * strength).toFixed(2)}px`);
    }
  }
}

createShaderBackground();
createPointerMotion();
