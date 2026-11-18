import { noiseGLSL } from './noise'

export const starVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;

uniform float uTime;
uniform float uPixelRatio;
uniform float uFade;
uniform float uTwinkle;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  float speed = 0.4 + aPhase * 1.8;
  float tw = sin(uTime * speed + aPhase * 61.0) * 0.5 + 0.5;
  tw = mix(1.0, 0.55 + 0.45 * tw, uTwinkle * smoothstep(1.2, 2.6, aSize));

  gl_PointSize = max(aSize * uPixelRatio, 1.0);
  vColor = aColor;
  vAlpha = uFade * tw * smoothstep(0.6, 1.6, aSize + 0.4);
}
`

export const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  float core = exp(-d2 * 40.0);
  float halo = exp(-d2 * 9.0) * 0.18;
  float a = (core + halo) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`

export const dustVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;

uniform float uTime;
uniform float uPixelRatio;
uniform float uFade;

varying float vAlpha;
varying float vPhase;

void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.05 + aPhase * 12.0) * 0.25;
  p.x += cos(uTime * 0.04 + aPhase * 7.0) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  gl_PointSize = aSize * uPixelRatio * (9.0 / depth);
  // Fade out when very close to the lens or far away
  vAlpha = uFade * smoothstep(1.5, 5.0, depth) * (1.0 - smoothstep(22.0, 34.0, depth));
  vPhase = aPhase;
}
`

export const dustFragment = /* glsl */ `
uniform vec3 uIon;
uniform vec3 uViolet;

varying float vAlpha;
varying float vPhase;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 18.0) * vAlpha * 0.32;
  if (a < 0.003) discard;
  vec3 col = mix(uIon, uViolet, vPhase);
  gl_FragColor = vec4(col * a, a);
}
`

/**
 * Nebula painted on the inside of a sky sphere. It is baked once into a cube
 * map at startup, so the per-frame cost is a single background lookup.
 */
export const nebulaVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const nebulaFragment = /* glsl */ `
uniform vec3 uVoid;
uniform vec3 uMidnight;
uniform vec3 uAbyss;
uniform vec3 uIon;
uniform vec3 uViolet;

varying vec3 vDir;

${noiseGLSL}

void main() {
  vec3 d = normalize(vDir);

  // A soft galactic band tilted across the sky
  vec3 bandNormal = normalize(vec3(0.35, 1.0, 0.25));
  float band = exp(-pow(dot(d, bandNormal) / 0.42, 2.0));

  // Broad, smooth cloud structure — low frequency so it reads as depth, not texture.
  vec3 q = d * 1.6;
  vec3 warp = vec3(fbm(q + 1.3), fbm(q + 5.1), fbm(q + 9.7));
  float broad = smoothstep(-0.2, 0.6, fbm(q * 0.9 + warp * 1.1));
  // Fine filaments live only inside the band.
  float filaments = pow(1.0 - abs(fbm(q * 3.0 + warp * 2.0)), 8.0);
  float lanes = smoothstep(0.2, 0.6, fbm(q * 3.4 - warp));

  float violetCloud = smoothstep(0.2, 1.0, dot(d, normalize(vec3(-0.8, 0.35, -0.5))));
  float ionCloud = smoothstep(0.35, 1.0, dot(d, normalize(vec3(0.9, -0.25, -0.35))));

  vec3 col = uVoid;
  col = mix(col, uMidnight, band * (0.35 + 0.4 * broad));
  col += uAbyss * band * (broad * 0.07 + filaments * 0.025);
  col += uViolet * broad * violetCloud * 0.028;
  col += uIon * broad * ionCloud * 0.016;
  col *= 1.0 - lanes * band * 0.3;
  col += vec3(0.6, 0.65, 0.9) * band * filaments * 0.003;

  gl_FragColor = vec4(col, 1.0);
}
`
