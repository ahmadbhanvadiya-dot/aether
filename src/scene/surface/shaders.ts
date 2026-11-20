import { terrainGLSL } from './terrain'

/**
 * Shared environment chunk: uniforms + the sky function used by the sky dome
 * AND by every surface material's fog, so the horizon is always seamless.
 * Requires terrainGLSL (noise) to be included first.
 */
export const envGLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uFog;
uniform float uStars;
uniform float uAurora;
uniform float uFlash;
uniform vec3 uFlashDir;
uniform float uTime;
uniform vec4 uMoons[4];
uniform float uRings;
uniform float uRingLat;
uniform float uRingYaw;
uniform float uFissure;
uniform float uMirror;
uniform float uWaves;
uniform float uWaterGlow;
uniform float uCloudCover;
uniform vec3 uCloudColor;
uniform float uCloudHeight;
uniform float uRain;
uniform float uMotes;
uniform vec3 uPalette[5];
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
uniform vec2 uWind;
uniform vec2 uDrift;
uniform float uLive;

float sunVisible() { return smoothstep(-0.08, 0.06, uSunDir.y); }

/**
 * Phase 7: the cloud layer's shadow on whatever is below it. Samples the same
 * field the cloud layer draws (scale, drift, cover), at the point where the ray
 * toward Elys crosses the layer, so the shadows move with the clouds above.
 */
#ifndef LIVE_OCT
#define LIVE_OCT 3
#endif
float cloudShadow(vec3 p) {
  if (uCloudCover < 0.03 || uCloudHeight < p.y + 2.0) return 1.0;
  float sy = max(uSunDir.y, 0.1);
  vec2 at = p.xz + uSunDir.xz / sy * (uCloudHeight - p.y);
  float c = fbm2(at * 0.0035 + uDrift * 0.5, LIVE_OCT) * 0.5 + 0.5;
  float dens = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.22, c);
  return 1.0 - dens * 0.55 * sunVisible();
}

vec3 skyBase(vec3 d) {
  float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.5));
  col = mix(col, uGround, 1.0 - smoothstep(-0.14, 0.0, y));
  float mu = max(dot(d, uSunDir), 0.0);
  float vis = smoothstep(-0.2, 0.05, uSunDir.y);
  col += uSunColor * (pow(mu, 6.0) * 0.16 + pow(mu, 48.0) * 0.3) * vis;
  col += uSunColor * pow(mu, 2.0) * 0.06 * (1.0 - clamp(abs(y) * 4.0, 0.0, 1.0)) * vis;
  col += vec3(0.62, 0.66, 0.95) * uFlash * (pow(max(dot(d, uFlashDir), 0.0), 4.0) * 1.4 + 0.12);
  return col;
}

vec3 applyFog(vec3 col, vec3 wpos) {
  vec3 v = wpos - cameraPosition;
  float dist = length(v);
  vec3 d = v / max(dist, 1e-4);
  float heightK = 1.0 + 1.5 * exp(-max(wpos.y, 0.0) * 0.012);
#if SKIND == 1
  // Nyx: banks of dark haze drift low across the plains.
  heightK *= 0.7 + 0.6 * smoothstep(-0.4, 0.6, vnoise(wpos.xz * 0.0025 + uDrift * 1.5));
#endif
  float f = 1.0 - exp(-dist * uFog * heightK);
  return mix(col, skyBase(d), clamp(f, 0.0, 1.0));
}

vec3 ambient(vec3 n) {
  vec3 sky = mix(uGround, uZenith, n.y * 0.5 + 0.5) * 0.55 + uHorizon * 0.12;
  // Starlight and aurora: night scenes keep a readable floor of light.
  vec3 night = vec3(0.3, 0.34, 0.52) * (0.05 + uStars * 0.07) + vec3(0.2, 0.6, 0.45) * uAurora * 0.1;
  return sky + night * (1.0 - sunVisible() * 0.8);
}
`

const header = /* glsl */ `
${terrainGLSL}
${envGLSL}
`

// ---------------------------------------------------------------------------
// Sky dome
// ---------------------------------------------------------------------------

export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

export const skyFragment = /* glsl */ `
${header}
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyBase(d);
  float mu = dot(d, uSunDir);

  // Elys
  col += uSunColor * smoothstep(0.99955, 0.9998, mu) * 8.0 * smoothstep(-0.06, 0.02, uSunDir.y + 0.03);

  // Stars
  if (uStars > 0.0 && d.y > -0.05) {
    vec2 sp = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 180.0;
    ivec2 cell = ivec2(floor(sp));
    float h = hash2(cell + ivec2(911, 377));
    if (h > 0.992) {
      vec2 f = fract(sp) - 0.5;
      float s = exp(-dot(f, f) * 40.0) * (h - 0.992) * 125.0;
      float tw = 0.7 + 0.3 * sin(uTime * (1.0 + h * 3.0) + h * 50.0);
      col += vec3(0.85, 0.9, 1.0) * s * tw * uStars * smoothstep(-0.05, 0.1, d.y) * 1.5;
    }
  }

  // Moons, lit by Elys
  for (int i = 0; i < 4; i++) {
    vec4 m = uMoons[i];
    if (m.w <= 0.0) continue;
    vec3 md = normalize(m.xyz);
    float c = dot(d, md);
    float ang = acos(clamp(c, -1.0, 1.0));
    float r = m.w;
    if (ang < r * 1.6) {
      float glowM = exp(-ang / r * 2.0) * 0.06;
      col += vec3(0.7, 0.75, 0.9) * glowM;
      if (ang < r) {
        vec3 tangent = normalize(d - md * c + vec3(1e-5));
        float x = ang / r;
        vec3 n = -md * sqrt(max(1.0 - x * x, 0.0)) + tangent * x;
        float lit = max(dot(n, uSunDir), 0.0);
        vec3 mc = vec3(0.78, 0.8, 0.86) * (lit * 1.3 + 0.025);
        float edge = 1.0 - smoothstep(0.92, 1.0, x);
        col = mix(col, mc, edge);
      }
    }
  }

  // Aurora curtains
  if (uAurora > 0.0 && d.y > 0.0) {
    float a = atan(d.z, d.x);
    float h = d.y;
    float curtain = smoothstep(0.5, 0.85, fbm2(vec2(a * 2.6 + uTime * 0.015, h * 1.2), 3) * 0.5 + 0.5);
    float streak = 0.5 + 0.5 * vnoise(vec2(a * 140.0, h * 3.0 - uTime * 0.2));
    float band = smoothstep(0.04, 0.18, h) * (1.0 - smoothstep(0.26, 0.5, h));
    vec3 ac = mix(vec3(0.2, 1.0, 0.65), vec3(0.55, 0.35, 1.0), smoothstep(0.12, 0.5, h));
    col += ac * curtain * streak * band * uAurora * 0.42;
  }

  // Ring system seen from inside the giant's atmosphere
  if (uRings > 0.5 && d.y > -0.02) {
    // The spin axis tips away from the view so the rings arch across it.
    vec3 axis = normalize(vec3(-sin(uRingYaw) * cos(uRingLat), sin(uRingLat), cos(uRingYaw) * cos(uRingLat)));
    vec3 o = vec3(0.0, 1.0, 0.0);
    float dn = dot(d, axis);
    if (abs(dn) > 1e-4) {
      float t = -dot(o, axis) / dn;
      if (t > 0.0) {
        vec3 q = o + d * t;
        float r = length(q);
        if (r > 1.35 && r < 2.35) {
          float x = (r - 1.35);
          float bands = vnoise(vec2(x * 70.0, 0.5)) * 0.45 + vnoise(vec2(x * 210.0, 2.5)) * 0.25 + vnoise(vec2(x * 14.0, 7.5)) * 0.5;
          float gap = smoothstep(0.6, 0.615, x) * (1.0 - smoothstep(0.655, 0.67, x));
          float dens = clamp(bands * 0.5 + 0.55, 0.0, 1.0) * (1.0 - gap * 0.92);
          // The rings turn: clumps of ice orbit, the inner ones faster (Kepler: r^-1.5).
          vec3 e1 = normalize(cross(axis, vec3(0.0, 0.0, 1.0)) + vec3(1e-4));
          vec3 e2 = cross(axis, e1);
          float ang = atan(dot(q, e2), dot(q, e1)) + uTime * 0.012 * pow(r, -1.5);
          dens *= 0.82 + 0.18 * vnoise(vec2(ang * 48.0, x * 30.0));
          dens *= smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.92, 1.0, x));
          vec3 rc = mix(vec3(0.62, 0.56, 0.48), vec3(0.95, 0.9, 0.8), vnoise(vec2(x * 34.0, 9.0)) * 0.5 + 0.5);
          // planet shadow on the rings
          float bq = dot(q, uSunDir);
          float cq = dot(q, q) - 1.0;
          float hq = bq * bq - cq;
          float shadow = (hq > 0.0 && -bq - sqrt(max(hq, 0.0)) > 0.0) ? 0.12 : 1.0;
          float fwd = pow(max(dot(d, uSunDir), 0.0), 5.0);
          rc *= (0.55 + fwd * 1.2) * shadow;
          float alpha = dens * 0.85 * smoothstep(-0.02, 0.04, d.y);
          col = mix(col, rc, alpha);
        }
      }
    }
  }

#if SKIND == 2
  // Solara: dust storms walk the horizon — a billowing wall in some directions, drifting.
  if (d.y > -0.05 && d.y < 0.3) {
    float a = atan(d.z, d.x);
    float where = smoothstep(0.6, 0.84, fbm2(vec2(a * 1.2 + uDrift.x * 0.8, 4.1), 3) * 0.5 + 0.5);
    float top = 0.015 + 0.085 * where * (0.75 + 0.25 * fbm2(vec2(a * 7.0 - uDrift.x * 3.0, 1.3), 3));
    float inside = (1.0 - smoothstep(top - 0.03, top, d.y)) * where;
    if (inside > 0.0) {
      float billow = fbm2(vec2(a * 18.0 - uDrift.x * 9.0, d.y * 40.0 - uTime * 0.04 * uLive), 3) * 0.5 + 0.5;
      vec3 dust = mix(uGround * 1.25, uHorizon * 1.1, billow) + uSunColor * 0.12 * pow(max(dot(d, uSunDir), 0.0), 2.0) * sunVisible();
      col = mix(col, dust, inside * 0.75);
    }
  }
#endif

#if SKIND == 4
  // Thalassa: rain curtains hang from distant cloud bases, sweeping with the wind.
  if (uCloudCover > 0.2 && d.y > -0.02 && d.y < 0.16) {
    float a = atan(d.z, d.x);
    float cell = smoothstep(0.55, 0.85, fbm2(vec2(a * 5.0 + uDrift.x * 2.0, 2.7), 3) * 0.5 + 0.5);
    float streak = 0.6 + 0.4 * vnoise(vec2(a * 380.0 + d.y * 40.0, d.y * 6.0 + uTime * 1.2 * uLive));
    float hang = smoothstep(0.16, 0.06, d.y) * smoothstep(-0.02, 0.02, d.y);
    col = mix(col, mix(uGround, uHorizon, 0.5) * 0.85, cell * hang * streak * 0.6 * uCloudCover);
  }
#endif

#if SKIND == 3
  // Storm towers on the horizon, lit from within by lightning
  if (d.y > -0.06) {
    float a = atan(d.z, d.x);
    float prof = 0.035 + 0.24 * pow(max(fbm2(vec2(a * 2.2, 3.7), 4) * 0.5 + 0.5 - 0.35, 0.0) * 1.6, 1.4);
    prof += fbm2(vec2(a * 30.0, d.y * 20.0), 2) * 0.012;
    float inside = 1.0 - smoothstep(prof - 0.012, prof, d.y);
    if (inside > 0.0) {
      float k = clamp(d.y / max(prof, 0.01), 0.0, 1.0);
      vec3 tc = mix(uGround * 1.15, uHorizon * 0.95, k);
      tc += uSunColor * 0.18 * pow(max(dot(d, uSunDir), 0.0), 2.0) * sunVisible();
      tc += vec3(0.78, 0.72, 1.0) * uFlash * pow(max(dot(d, uFlashDir), 0.0), 3.0) * 1.8;
      col = mix(col, tc, inside);
    }
  }
#endif

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------------------
// Terrain (and cloud decks on Vesper / Orion)
// ---------------------------------------------------------------------------

export const terrainVertex = /* glsl */ `
${header}
varying vec3 vWorld;
varying vec3 vNormalW;

void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float h = terrainHeight(wp.xz);
  float r = length(position.xz);
  float e = clamp(r * 0.012, 0.25, 12.0);
  float hx = terrainHeight(wp.xz + vec2(e, 0.0));
  float hz = terrainHeight(wp.xz + vec2(0.0, e));
  vNormalW = normalize(vec3(h - hx, e, h - hz));
  wp.y = h;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`

export const terrainFragment = /* glsl */ `
${header}
varying vec3 vWorld;
varying vec3 vNormalW;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 p = vWorld;
  float h = p.y;
  float slope = 1.0 - n.y;
  float micro = fbm2(p.xz * 0.35, 2);
  vec3 albedo = vec3(0.5);
  vec3 emissive = vec3(0.0);
  float specAmt = 0.0;
  float wrap = 0.0;

#if SKIND == 0
  float snowLine = 95.0 + micro * 8.0;
  albedo = mix(uPalette[1], uPalette[2], smoothstep(10.0, 55.0, h + micro * 6.0));
  albedo = mix(uPalette[0], albedo, smoothstep(0.6, 3.0, h));
  albedo = mix(albedo, uPalette[3], smoothstep(0.28, 0.5, slope + micro * 0.06));
  albedo = mix(albedo, uPalette[4], smoothstep(snowLine, snowLine + 12.0, h) * (1.0 - smoothstep(0.45, 0.7, slope)));
  albedo *= 0.85 + micro * 0.25;
  // Aurelis: gusts run across the grasslands as soft, moving bands of light.
  {
    vec2 wd = normalize(uWind + vec2(1e-5));
    vec2 wq = vec2(dot(p.xz, wd), dot(p.xz, vec2(-wd.y, wd.x)));
    float gust = smoothstep(0.55, 0.9, vnoise(vec2(wq.x * 0.02 - uDrift.x * 40.0, wq.y * 0.006)) * 0.5 + 0.5);
    float grass = smoothstep(0.6, 3.0, h) * (1.0 - smoothstep(40.0, 60.0, h)) * (1.0 - smoothstep(0.25, 0.45, slope));
    albedo *= 1.0 + 0.14 * gust * grass * uLive;
  }
#elif SKIND == 1
  albedo = mix(uPalette[0], uPalette[1], smoothstep(-15.0, 25.0, h + micro * 5.0));
  albedo = mix(albedo, uPalette[3], smoothstep(0.3, 0.6, slope) * 0.6);
  specAmt = 0.45;
  // Fissures follow the zero contours of noise: thin, continuous, branching lines.
  float c1 = 1.0 - abs(vnoise(p.xz * 0.018));
  float c2 = 1.0 - abs(vnoise(p.xz * 0.06 + 7.0));
  float lines = smoothstep(0.965, 0.995, c1) + smoothstep(0.98, 0.997, c2) * 0.5;
  // Nyx: the whole field breathes slowly; each vein also flickers on its own.
  float breathe = 0.72 + 0.28 * sin(uTime * 0.11 + p.x * 0.0021 - p.z * 0.0017);
  float crack = lines * (0.6 + 0.4 * sin(uTime * 0.7 + p.x * 0.01 + p.z * 0.013)) * breathe;
  vec3 veinCol = mix(vec3(0.5, 0.34, 1.0), vec3(0.32, 0.6, 1.0), smoothstep(0.0, 0.8, micro));
  emissive = veinCol * crack * uFissure * 0.9;
  // ...and lights the ground around it: a soft violet uplight beside each fissure.
  float halo = smoothstep(0.86, 0.97, c1) * (1.0 - smoothstep(0.97, 0.995, c1));
  emissive += albedo * veinCol * halo * breathe * uFissure * 2.2;
#elif SKIND == 2
  albedo = mix(uPalette[0], uPalette[1], (0.5 + 0.5 * micro) * 0.6 + smoothstep(0.0, 30.0, h) * 0.3);
  float strata = 0.5 + 0.5 * sin(h * 0.7 + micro * 2.0);
  vec3 rockC = mix(uPalette[2], uPalette[3], strata);
  albedo = mix(albedo, rockC, smoothstep(0.22, 0.45, slope));
  albedo = mix(albedo, uPalette[4], uMirror * (1.0 - smoothstep(2.0, 6.0, h)));
  // Solara: sand streams across the ground downwind, near the eye.
  {
    vec2 wd = normalize(uWind + vec2(1e-5));
    vec2 sq = vec2(dot(p.xz, wd), dot(p.xz, vec2(-wd.y, wd.x)));
    // Short wisps (not continuous lines) that come and go in gust patches.
    float stream = vnoise(vec2(sq.x * 0.12 - uDrift.x * 160.0, sq.y * 0.55)) * 0.5 + 0.5;
    float patchy = smoothstep(0.15, 0.75, vnoise(sq * 0.009 - uDrift * 25.0) * 0.5 + 0.5);
    float near = 1.0 - smoothstep(50.0, 320.0, length(p.xz - cameraPosition.xz));
    float level = 1.0 - smoothstep(0.12, 0.3, slope);
    albedo = mix(albedo, uPalette[1] * 1.18, smoothstep(0.68, 0.95, stream) * patchy * near * level * 0.36 * uLive);
  }
#elif SKIND == 3
  float c = fbm2(p.xz * 0.012 + uDrift, 3) * 0.5 + 0.5;
  albedo = mix(uPalette[0], uPalette[1], smoothstep(-20.0, 4.0, h));
  albedo = mix(albedo, uPalette[2], smoothstep(0.45, 0.85, c) * smoothstep(-6.0, 8.0, h));
  albedo = mix(albedo, uPalette[3], smoothstep(0.55, 0.9, fbm2(p.xz * 0.004, 2) * 0.5 + 0.5) * 0.5);
  // Vesper: the decks brighten and dim slowly as light filters through moving layers above.
  albedo *= 0.93 + 0.07 * sin(uTime * 0.05 + c * 6.0 + p.x * 0.001);
  emissive = vec3(0.7, 0.6, 1.0) * uFlash * pow(max(dot(normalize(p - cameraPosition), uFlashDir), 0.0), 3.0) * 0.5;
  wrap = 0.35;
#elif SKIND == 4
  albedo = mix(uPalette[0], uPalette[1], smoothstep(1.0, 12.0, h));
  albedo = mix(albedo, uPalette[2], smoothstep(15.0, 30.0, h) * (1.0 - smoothstep(0.3, 0.55, slope)) * 0.7);
  albedo = mix(albedo, uPalette[3], smoothstep(55.0, 80.0, h));
#else
  float latB = p.z * 0.003 + fbm2(p.xz * 0.002, 3) * 1.2;
  float bands = 0.5 + 0.5 * sin(latB * 6.0 + fbm2(p.xz * 0.006 + uDrift, 3) * 2.0);
  albedo = mix(uPalette[0], uPalette[1], smoothstep(0.2, 0.6, bands));
  albedo = mix(albedo, uPalette[2], smoothstep(0.6, 0.95, bands));
  // Orion: small storms ride the bands, turning as they drift east.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c0 = vec2(mod(fi * 1171.0 + uDrift.x * 2600.0, 3600.0) - 1800.0, fi * 520.0 - 600.0) + cameraPosition.xz * vec2(0.0, 1.0);
    vec2 dv = p.xz - c0;
    float rad = 140.0 + fi * 60.0;
    float dist = length(dv / vec2(1.0, 0.6));
    if (dist < rad) {
      float ang = atan(dv.y, dv.x) + dist * 0.03 - uTime * 0.05 * (1.0 + fi * 0.3);
      float sw = 0.5 + 0.5 * sin(ang * 2.0);
      albedo = mix(albedo, mix(uPalette[1], uPalette[2] * 1.1, sw), (1.0 - smoothstep(rad * 0.3, rad, dist)) * 0.7);
    }
  }
  wrap = 0.35;
#endif

#if SKIND == 3 || SKIND == 5
  // Vortex coloring inside an abyss: the storm eye spirals down
  for (int i = 0; i < 3; i++) {
    if (int(uLocB[i].y + 0.5) != 6) continue;
    vec2 dv = p.xz - uLocA[i].xy;
    float dist = length(dv);
    float rad = uLocB[i].z;
    if (dist < rad * 1.4) {
      float ang = atan(dv.y, dv.x) + dist * 0.025 - uTime * 0.02;
      float sw = 0.5 + 0.5 * sin(ang * 3.0 + fbm2(dv * 0.01, 2) * 3.0);
      float m = 1.0 - smoothstep(rad * 0.5, rad * 1.4, dist);
#if SKIND == 5
      vec3 vc = mix(uPalette[4] * 0.5, uPalette[4], sw);
#else
      vec3 vc = mix(uPalette[0] * 0.6, uPalette[3], sw);
#endif
      albedo = mix(albedo, vc, m * 0.85);
    }
  }
#endif

  vec3 L = uSunDir;
  float diff = max((dot(n, L) + wrap) / (1.0 + wrap), 0.0) * sunVisible() * cloudShadow(p);
  vec3 col = albedo * (uSunColor * diff * 1.6 + ambient(n));
  vec3 V = normalize(cameraPosition - p);
  vec3 Hh = normalize(L + V);
  col += uSunColor * pow(max(dot(n, Hh), 0.0), 60.0) * specAmt * diff;

#if SKIND == 2
  // The Salt Mirror: flat salt reflects the sky
  vec3 Rv = reflect(-V, vec3(0.0, 1.0, 0.0));
  float flatness = uMirror * (1.0 - smoothstep(2.0, 5.0, h)) * (1.0 - smoothstep(0.02, 0.08, slope));
  float fres = 0.25 + 0.75 * pow(1.0 - max(V.y, 0.0), 4.0);
  col = mix(col, skyBase(Rv) * 1.05, flatness * fres * 0.85);
#endif

  col += emissive;
  col += albedo * vec3(0.6, 0.65, 0.95) * uFlash * 0.25;
  col = applyFog(col, p);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export const waterVertex = /* glsl */ `
${header}
varying vec3 vWorld;
varying float vDepth;
varying vec3 vWaveN;

void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float g = terrainHeight(wp.xz);
  vDepth = -g;
  float t = uTime;
  // Swell arrives in sets: groups of larger waves every half minute or so.
  float A = uWaves * (0.78 + 0.32 * sin(t * 0.21 + dot(wp.xz, vec2(0.0022, 0.0011))) * (0.6 + 0.4 * sin(t * 0.047)));
  vec2 d1 = normalize(vec2(1.0, 0.3));
  vec2 d2 = normalize(vec2(-0.4, 1.0));
  vec2 d3 = normalize(vec2(0.7, -0.8));
  float k1 = 0.045, k2 = 0.08, k3 = 0.13;
  float a1 = 2.4 * A, a2 = 1.1 * A, a3 = 0.45 * A + 0.04;
  float p1 = dot(d1, wp.xz) * k1 + t * 1.1;
  float p2 = dot(d2, wp.xz) * k2 + t * 1.4;
  float p3 = dot(d3, wp.xz) * k3 + t * 1.9;
  float y = a1 * sin(p1) + a2 * sin(p2) + a3 * sin(p3);
  float dx = a1 * k1 * d1.x * cos(p1) + a2 * k2 * d2.x * cos(p2) + a3 * k3 * d3.x * cos(p3);
  float dz = a1 * k1 * d1.y * cos(p1) + a2 * k2 * d2.y * cos(p2) + a3 * k3 * d3.y * cos(p3);
  float fade = (1.0 - smoothstep(300.0, 900.0, length(position.xz))) * mix(0.25, 1.0, smoothstep(0.0, 6.0, vDepth));
  y *= fade;
  dx *= fade;
  dz *= fade;
  wp.y = y;
  vWaveN = normalize(vec3(-dx, 1.0, -dz));
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`

export const waterFragment = /* glsl */ `
${header}
varying vec3 vWorld;
varying float vDepth;
varying vec3 vWaveN;

void main() {
  vec3 p = vWorld;
  // Two scales of ripple, rotated against each other so no grid shows, fading with distance.
  float camDist = length(p - cameraPosition);
  vec2 rp = p.xz * 0.9 + uTime * vec2(0.5, 0.3);
  vec2 rq = vec2(0.8 * p.x - 0.6 * p.z, 0.6 * p.x + 0.8 * p.z) * 2.3 - uTime * vec2(0.2, 0.6);
  float r1 = vnoise(rp) * 0.6 + vnoise(rq) * 0.4;
  float r2 = vnoise(rp + vec2(0.15, 0.0)) * 0.6 + vnoise(rq + vec2(0.15, 0.0)) * 0.4;
  float r3 = vnoise(rp + vec2(0.0, 0.15)) * 0.6 + vnoise(rq + vec2(0.0, 0.15)) * 0.4;
  float ripple = (0.6 + uWaves * 1.2) * (1.0 - smoothstep(25.0, 220.0, camDist));
  vec3 n = normalize(vWaveN + vec3(r1 - r2, 0.0, r1 - r3) * ripple);
  vec3 V = normalize(cameraPosition - p);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 Rv = reflect(-V, n);
  Rv.y = abs(Rv.y);
  vec3 refl = skyBase(Rv);
  float shade = cloudShadow(p);
  float glint = pow(max(dot(Rv, uSunDir), 0.0), 300.0) * sunVisible() * shade;
  refl += uSunColor * glint * 6.0;

  float depth = max(vDepth, 0.0);
  vec3 body = mix(uWaterShallow, uWaterDeep, smoothstep(0.0, 14.0, depth));
  body *= uSunColor * max(uSunDir.y, 0.0) * 0.9 * shade + ambient(vec3(0.0, 1.0, 0.0));

  // Bioluminescent currents
  // Bioluminescent currents: thin ribbons along noise contours, drifting and flickering.
  vec2 cq = p.xz * 0.009 + vec2(uTime * 0.006, uTime * 0.002);
  float r1c = 1.0 - abs(vnoise(cq));
  float r2c = 1.0 - abs(vnoise(cq * 3.1 + 11.0));
  float ribbon = smoothstep(0.965, 0.995, r1c) + smoothstep(0.98, 0.997, r2c) * 0.6;
  float g2 = smoothstep(0.35, 1.0, vnoise(p.xz * 0.12 - uTime * vec2(0.25, 0.1)) * 0.5 + 0.5);
  vec3 glow = vec3(0.12, 0.95, 0.85) * ribbon * (0.4 + 0.9 * g2) * uWaterGlow;

  float foam = (1.0 - smoothstep(0.0, 0.8, depth)) * (0.6 + 0.4 * r1) + smoothstep(1.6, 3.0, p.y) * uWaves * 0.8;
  vec3 col = mix(body, refl, fres) + glow;
  col = mix(col, vec3(0.9, 0.95, 1.0) * (ambient(vec3(0.0, 1.0, 0.0)) + uSunColor * 0.5), clamp(foam, 0.0, 1.0) * 0.7);
  col += vec3(0.6, 0.65, 0.95) * uFlash * 0.2;
  col = applyFog(col, p);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------------------
// Cloud layer
// ---------------------------------------------------------------------------

export const cloudVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const cloudFragment = /* glsl */ `
${header}
varying vec3 vWorld;

void main() {
  vec3 p = vWorld;
  vec2 q = p.xz * 0.0035 + uDrift * 0.5;
  float c = fbm2(q, OCT) * 0.5 + 0.5;
  float c2 = fbm2(q * 3.1 + 3.0, 3) * 0.5 + 0.5;
  float dens = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.22, c * 0.8 + c2 * 0.2);
  bool above = cameraPosition.y > p.y;
  vec3 lit = uCloudColor * (uSunColor * max(uSunDir.y + 0.15, 0.0) * 1.2 + ambient(vec3(0.0, 1.0, 0.0)) * 1.2);
  vec3 under = uCloudColor * ambient(vec3(0.0, -1.0, 0.0)) * 0.8;
  vec3 col = above ? lit : under;
  col += uSunColor * pow(max(dot(normalize(p - cameraPosition), uSunDir), 0.0), 8.0) * 0.4 * dens * sunVisible();
  col += vec3(0.7, 0.7, 1.0) * uFlash * 0.6;
  dens *= smoothstep(2.0, 25.0, abs(cameraPosition.y - p.y));
  col = applyFog(col, p);
  gl_FragColor = vec4(col, dens * 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------------------
// Weather: motes (dust, ash, snow, spray, haze) and rain
// ---------------------------------------------------------------------------

export const motesVertex = /* glsl */ `
attribute vec3 aSeed;
attribute float aRand;
uniform float uTime;
uniform vec3 uVel;
uniform float uSize;
uniform float uPR;
uniform float uAmount;
varying float vA;
void main() {
  vec3 box = vec3(80.0, 40.0, 80.0);
  vec3 pos = aSeed * box + uVel * uTime * (0.6 + aRand * 0.8);
  vec3 rel = mod(pos - cameraPosition + box * 0.5, box) - box * 0.5;
  vec3 wp = cameraPosition + rel;
  wp.x += sin(uTime * 0.7 + aRand * 30.0) * 0.6;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  gl_PointSize = min(uSize * uPR * (0.6 + aRand) * (20.0 / max(dist, 0.5)), 12.0 * uPR);
  vA = uAmount * smoothstep(0.5, 3.0, dist) * (1.0 - smoothstep(25.0, 40.0, dist));
}
`

export const motesFragment = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`

export const rainVertex = /* glsl */ `
attribute vec3 aSeed;
attribute float aEnd;
uniform float uTime;
uniform float uAmount;
varying float vA;
void main() {
  vec3 box = vec3(60.0, 40.0, 60.0);
  vec3 vel = vec3(6.0, -38.0, 3.0);
  vec3 pos = aSeed * box + vel * uTime;
  vec3 rel = mod(pos - cameraPosition + box * 0.5, box) - box * 0.5;
  vec3 wp = cameraPosition + rel - normalize(vel) * aEnd * 1.6;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = uAmount * (1.0 - aEnd * 0.8) * smoothstep(0.5, 2.0, -mv.z) * (1.0 - smoothstep(20.0, 30.0, -mv.z));
}
`

export const rainFragment = /* glsl */ `
varying float vA;
void main() {
  gl_FragColor = vec4(vec3(0.75, 0.82, 0.9) * vA, vA);
}
`

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

export const landmarkVertex = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const landmarkFragment = /* glsl */ `
${header}
uniform vec3 uRock;
uniform vec3 uGlowColor;
uniform float uGlowAmt;
uniform float uSeam;
uniform float uHeight;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float diff = max(dot(n, uSunDir), 0.0) * sunVisible();
  float grain = vnoise(vLocal.xy * 1.7 + vLocal.z) * 0.12;
  vec3 col = uRock * (1.0 + grain) * (uSunColor * diff * 1.5 + ambient(n));
  col += uSunColor * pow(max(dot(n, normalize(uSunDir + V)), 0.0), 40.0) * 0.25 * diff;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  float seam = uSeam * smoothstep(0.93, 0.98, fract(vLocal.y / max(uHeight / 5.0, 1.0)));
  float rise = smoothstep(0.0, 1.0, vLocal.y / max(uHeight, 1.0));
  float pulse = 0.75 + 0.25 * sin(uTime * 0.8 + vLocal.y * 0.1);
  col += uGlowColor * (rim * 0.7 + seam * 1.6 + rise * 0.5) * uGlowAmt * pulse;
  col += uRock * vec3(0.6, 0.65, 0.95) * uFlash * 0.3;
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const plumeVertex = /* glsl */ `
attribute float aRand;
attribute float aPhase;
uniform float uTime;
uniform float uHeight;
uniform float uPR;
uniform float uScale;
varying float vA;
void main() {
  float life = fract(uTime * (0.08 + aRand * 0.05) + aPhase);
  float spread = (2.0 + life * 10.0) * uScale;
  vec3 p = vec3(cos(aPhase * 40.0) * spread * aRand, life * uHeight, sin(aPhase * 40.0) * spread * aRand);
  p.x += life * life * 6.0 * uScale;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min((6.0 + life * 30.0) * uScale * uPR * (40.0 / max(-mv.z, 1.0)), 90.0 * uPR);
  vA = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.5, 1.0, life));
}
`

export const plumeFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 7.0) * vA * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`

// ---------------------------------------------------------------------------
// The discovery signal
// ---------------------------------------------------------------------------

export const beaconCoreFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uPulse;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  float core = exp(-d * d * 18.0) * 3.0;
  float halo = exp(-d * 3.5) * 0.6;
  float a = (core + halo) * uPulse * smoothstep(1.0, 0.8, d);
  gl_FragColor = vec4(uColor * a, a);
}
`

export const beaconRingFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  float ring = exp(-pow((d - uRadius) / 0.035, 2.0));
  float a = ring * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`

export const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(edge, 3.0) * (1.0 - vUv.y) * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}
`

export const uvVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
