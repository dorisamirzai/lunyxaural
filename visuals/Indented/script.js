const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl');
if (!gl) alert('WebGL not supported');

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// --- Vertex shader: just a fullscreen triangle pair, no transforms needed ---
const vertSrc = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// --- Fragment shader: domain-warped noise contours + corrosion palette ---
const fragSrc = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uReactive; // 0..1, drive this from audio amplitude later

// ---- 2D simplex-style noise (standard hashing approach) ----
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.55;
  }
  return v;
}

// Convert HSL -> RGB so we can dial saturation independently of hue
vec3 hsl2rgb(vec3 hsl) {
  vec3 rgb = clamp(abs(mod(hsl.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return hsl.z + hsl.y * (rgb - 0.5) * (1.0 - abs(2.0 * hsl.z - 1.0));
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uRes.xy) * 2.0 - 1.0;
  uv.x *= uRes.x / uRes.y;

  // vertical mirror symmetry -> the centred, face-like motif
  vec2 p = vec2(abs(uv.x), uv.y) * 2.2;

  float t = uTime * (0.06 + uReactive * 0.15);

  // domain warp - this is what creates the flowing ridge lines
  vec2 warp = vec2(
    fbm(p + vec2(0.0, t)),
    fbm(p + vec2(5.2, 1.3) - t)
  );
  p += warp * (1.1 + uReactive * 0.6);

  float n = fbm(p * 1.4 + t * 0.6);

  // turn the smooth field into contour bands (the "topographic" look)
  float bands = sin(n * 18.0) * 0.5 + 0.5;
  bands = smoothstep(0.15, 0.85, bands);

  // ---- moss green / terracotta / purple / metallic palette ----
  vec3 moss       = vec3(0.34, 0.40, 0.22); // muted olive-green
  vec3 terracotta = vec3(0.60, 0.34, 0.21); // warm clay
  vec3 purple     = vec3(0.38, 0.27, 0.40); // dusty plum
  vec3 metallic   = vec3(0.48, 0.50, 0.53); // cool grey-steel

  // walk smoothly round the 4 anchor colours based on the noise field
  float pt = fract(n * 0.25 + t * 0.04 + bands * 0.18) * 4.0;
  vec3 col;
  if (pt < 1.0)      col = mix(moss, terracotta, pt);
  else if (pt < 2.0) col = mix(terracotta, purple, pt - 1.0);
  else if (pt < 3.0) col = mix(purple, metallic, pt - 2.0);
  else               col = mix(metallic, moss, pt - 3.0);

  // lightness contrast: dark in the ridges, lifted on the peaks
  col *= mix(0.35, 1.15, bands);

  // subtle metallic glint on the brightest peaks
  col += smoothstep(0.88, 1.0, bands) * 0.12;

  // vignette - fades to near-black at the edges like the weathered metal border
  vec3 dark = vec3(0.015, 0.02, 0.015);
  float vig = smoothstep(1.25, 0.1, length(uv));
  col = mix(dark * 0.4, col, vig);

  // film grain
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.035;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
gl.linkProgram(prog);
gl.useProgram(prog);

// Two triangles covering the full screen — the shader draws everything per-pixel
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,  1, -1,  -1, 1,
  -1,  1,  1, -1,   1, 1
]), gl.STATIC_DRAW);

const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(prog, 'uRes');
const uTime = gl.getUniformLocation(prog, 'uTime');
const uReactive = gl.getUniformLocation(prog, 'uReactive');

let reactive = 0; // set this from audio amplitude if you wire in Web Audio API

function render(time) {
  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, time * 0.001);
  gl.uniform1f(uReactive, reactive);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);