import { noiseGLSL } from '../shaders/noise'

/**
 * Kind ids shared by bake + surface shaders (injected as #define KIND).
 * Keep in sync with KIND_IDS in World.tsx.
 */
const kindDefines = /* glsl */ `
#define K_TERRESTRIAL 0
#define K_DARK 1
#define K_DESERT 2
#define K_CLOUD 3
#define K_OCEAN 4
#define K_GIANT 5
`

// ---------------------------------------------------------------------------
// Terrain bake — one equirectangular half-float texture per world, evaluated
// once on the GPU while the prelude is up. Channel meanings depend on KIND.
// ---------------------------------------------------------------------------

export const bakeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const bakeFragment = /* glsl */ `
${kindDefines}
uniform float uSeed;
varying vec2 vUv;
${noiseGLSL}

void main() {
  const float PI = 3.141592653589793;
  float lon = vUv.x * 2.0 * PI - PI;
  float lat = (vUv.y - 0.5) * PI;
  vec3 p = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  vec3 s = vec3(uSeed * 7.13, uSeed * 3.71, uSeed * 5.29);
  vec4 o = vec4(0.0);

#if KIND == K_TERRESTRIAL
  vec3 q = p * 1.6 + s;
  vec3 w = vec3(snoise(q * 0.8 + 1.7), snoise(q * 0.8 + 8.3), snoise(q * 0.8 + 4.1));
  o.r = fbm(q + w * 0.6);                                  // height
  o.g = ridged(p * 3.6 + w * 0.3 + s);                     // mountains
  o.b = snoise(p * 9.0 + w + s);                           // mineral / vegetation
  vec3 cq = p * vec3(2.2, 4.4, 2.2) + s * 1.3;
  vec3 cw = vec3(snoise(cq * 0.6 + 3.1), snoise(cq * 0.6 + 7.7), snoise(cq * 0.6 + 1.3));
  o.a = fbm(cq + cw * 0.9);                                // clouds

#elif KIND == K_DARK
  vec3 q = p * 1.8 + s;
  vec3 w = vec3(snoise(q + 2.2), snoise(q + 6.6), snoise(q + 9.9));
  o.r = fbm(q + w * 0.4);                                  // relief
  float f = fbm(p * 3.2 + w * 0.8 + s);
  o.g = pow(1.0 - abs(f), 14.0);                           // fissures: thin bright veins
  o.b = snoise(p * 6.0 + s);                               // glow variation
  o.a = pow(1.0 - abs(fbm(p * 7.0 + w + s)), 18.0);        // fine secondary veins

#elif KIND == K_DESERT
  vec3 q = p * 1.3 + s;
  vec3 w = vec3(snoise(q + 1.1), snoise(q + 5.5), snoise(q + 8.8));
  o.r = fbm(q + w * 0.7);                                  // basins & plateaus
  float dir = dot(p, normalize(vec3(0.8, 0.25, 0.55)));
  float warpD = fbm(p * 2.5 + s) * 6.0;
  o.g = sin(dir * 90.0 + warpD * 3.0) * 0.5 + 0.5;         // dune crests
  o.b = ridged(p * 4.2 + w * 0.5 + s);                     // canyons
  vec3 dq = p * vec3(2.0, 3.0, 2.0) + s * 2.0;
  o.a = fbm(dq + w);                                       // dust storms

#elif KIND == K_CLOUD
  vec3 q = p * vec3(1.4, 4.2, 1.4) + s;
  vec3 w = vec3(fbm(q + 1.7), fbm(q + 9.2), fbm(q + 4.4));
  o.r = fbm(q + w * 1.8);                                  // swirling cloud tops
  o.g = sin(lat * 9.0 + fbm(p * 2.0 + s) * 2.2) * 0.5 + 0.5; // bands
  o.b = fbm(p * 6.0 + w * 2.0 + s);                        // fine haze
  o.a = snoise(p * 30.0 + s);                              // lightning cells

#elif KIND == K_OCEAN
  vec3 q = p * 2.4 + s;
  vec3 w = vec3(snoise(q * 0.7 + 3.3), snoise(q * 0.7 + 1.1), snoise(q * 0.7 + 7.4));
  o.r = fbm(q + w * 0.5);                                  // seafloor / islands
  o.g = fbm(p * 1.8 + w * 1.6 + s);                        // currents
  o.b = snoise(p * 14.0 + w + s);                          // fine sea texture
  vec3 cq = p * vec3(2.6, 5.0, 2.6) + s * 1.7;
  vec3 cw = vec3(snoise(cq * 0.5 + 2.0), snoise(cq * 0.5 + 6.0), snoise(cq * 0.5 + 9.0));
  o.a = fbm(cq + cw * 1.2);                                // clouds

#elif KIND == K_GIANT
  float turb = fbm(p * vec3(2.0, 7.0, 2.0) + s);
  float bands = sin(lat * 15.0 + turb * 1.6) * 0.5 + 0.5;
  bands = mix(bands, sin(lat * 37.0 + turb * 2.4) * 0.5 + 0.5, 0.35);
  o.r = bands;
  o.g = fbm(p * vec3(3.0, 12.0, 3.0) + vec3(turb) + s);   // turbulence
  o.b = fbm(p * 9.0 + s);                                  // fine eddies
  o.a = turb;
#endif

  gl_FragColor = o;
}
`

// ---------------------------------------------------------------------------
// World surface
// ---------------------------------------------------------------------------

export const worldVertex = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vObjPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const worldFragment = /* glsl */ `
${kindDefines}
uniform vec3 uSunPos;
uniform vec3 uSunColor;
#ifdef SUN2
// Phase 11: a second sun (Tessaly's binary).
uniform vec3 uSun2Pos;
uniform vec3 uSun2Color;
#endif
// Eclipses: a moon between this point and Elys casts a soft shadow (world space,
// the moons as drawn). Positions and radii come from Moons.tsx; w = 0 is unused.
uniform vec4 uMoonShadow[5];
float moonShade(vec3 p, vec3 L) {
  float s = 1.0;
  for (int i = 0; i < 5; i++) {
    vec4 m = uMoonShadow[i];
    if (m.w <= 0.0) continue;
    vec3 toM = m.xyz - p;
    float t = dot(toM, L);
    if (t <= 0.0) continue;
    float d = length(toM - L * t);
    float pen = m.w * 0.35 + t * 0.012;
    s *= mix(0.1, 1.0, smoothstep(m.w - pen, m.w + pen, d));
  }
  return s;
}

uniform sampler2D uTerrain;
uniform vec2 uTexel;
uniform mat3 uModelRot;
uniform float uTime;
uniform vec3 uAtmoDay;
uniform vec3 uAtmoNight;
uniform vec3 uIon;
uniform vec3 uViolet;
uniform float uHighlight;
#ifdef RINGS
uniform vec3 uCenter;
uniform float uRingInner;
uniform float uRingOuter;
float ringHash(float n) { return fract(sin(n) * 43758.5453); }
float ringNoise(float x) {
  float i = floor(x);
  return mix(ringHash(i), ringHash(i + 1.0), smoothstep(0.0, 1.0, fract(x)));
}
/**
 * Light reaching a surface point through the rings: follow the ray toward the
 * star to the ring plane (the spin axis is the ring normal) and use the rings'
 * own density there, the same bands and gap the ring shader draws.
 */
float ringShadow(vec3 P, vec3 L) {
  vec3 n = normalize(uModelRot * vec3(0.0, 1.0, 0.0));
  float denom = dot(L, n);
  if (abs(denom) < 1e-4) return 1.0;
  float t = dot(uCenter - P, n) / denom;
  if (t <= 0.0) return 1.0;
  float r = length(P + L * t - uCenter);
  float x = (r - uRingInner) / (uRingOuter - uRingInner);
  if (x < 0.0 || x > 1.0) return 1.0;
  float bands = ringNoise(x * 70.0) * 0.45 + ringNoise(x * 210.0) * 0.25 + ringNoise(x * 14.0) * 0.5;
  float gap = smoothstep(0.6, 0.615, x) * (1.0 - smoothstep(0.655, 0.67, x));
  float density = clamp(bands, 0.0, 1.0) * (1.0 - gap * 0.92);
  density *= smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.9, 1.0, x));
  return 1.0 - density * 0.78;
}
#endif

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

const float PI = 3.141592653589793;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec4 T(vec2 uv) { return texture2D(uTerrain, uv); }

// Phase 7: smooth value noise for weather drifting over the baked surface.
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

float heightOf(vec4 t) {
#if KIND == K_TERRESTRIAL
  float land = smoothstep(0.02, 0.05, t.r);
  return land * (max(t.r - 0.03, 0.0) * 1.6 + t.g * t.g * 0.25);
#elif KIND == K_DARK
  return t.r * 0.9 - t.g * 0.18;
#elif KIND == K_DESERT
  return t.r * 0.7 + t.g * 0.035 + t.b * t.b * 0.35;
#elif KIND == K_OCEAN
  float land = smoothstep(0.3, 0.33, t.r);
  return land * (t.r - 0.3) * 2.0;
#else
  return 0.0;
#endif
}

void main() {
  vec3 p = normalize(vObjPos);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);

#if KIND == K_CLOUD || KIND == K_GIANT
  // Atmospheres turn faster at the equator: a gentle, bounded shear.
  uv.x += uTime * 0.0025 * (1.0 + 0.35 * cos(lat * 2.0));
#endif

  vec4 t = T(uv);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdL = dot(N, L);

  // --- Normal from the baked height field --------------------------------
  vec3 Nb = N;
#if KIND != K_CLOUD && KIND != K_GIANT
  {
    float hE = heightOf(T(uv + vec2(uTexel.x, 0.0)));
    float hW = heightOf(T(uv - vec2(uTexel.x, 0.0)));
    float hN = heightOf(T(uv + vec2(0.0, uTexel.y)));
    float hS = heightOf(T(uv - vec2(0.0, uTexel.y)));
    float cosLat = max(cos(lat), 0.05);
    float dE = (hE - hW) / (2.0 * uTexel.x * 2.0 * PI * cosLat);
    float dN = (hN - hS) / (2.0 * uTexel.y * PI);
    vec3 east = vec3(-sin(lon), 0.0, cos(lon));
    vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), -sin(lat) * sin(lon));
    vec3 nObj = normalize(p - BUMP * (dE * east + dN * north));
    Nb = normalize(uModelRot * nObj);
  }
#endif

  vec3 albedo = vec3(0.5);
  vec3 emissive = vec3(0.0);
  float water = 0.0;
  float rough = 70.0;
  float wrap = 0.0;

#if KIND == K_TERRESTRIAL
  float sea = 0.03;
  float land = smoothstep(sea - 0.004, sea + 0.018, t.r);
  float elev = max(t.r - sea, 0.0);
  float ice = smoothstep(0.84, 0.94, abs(p.y) + t.b * 0.04 + elev * 0.4);
  vec3 ocean = mix(vec3(0.004, 0.03, 0.09), vec3(0.03, 0.17, 0.32), smoothstep(-0.3, sea, t.r));
  vec3 lowland = mix(vec3(0.07, 0.11, 0.04), vec3(0.2, 0.18, 0.07), t.b * 0.5 + 0.5);
  vec3 high = mix(vec3(0.24, 0.2, 0.14), vec3(0.45, 0.42, 0.38), smoothstep(0.15, 0.4, elev + t.g * 0.12));
  vec3 landCol = mix(lowland, high, smoothstep(0.04, 0.26, elev));
  albedo = mix(ocean, landCol, land);
  albedo = mix(albedo, vec3(0.8, 0.85, 0.9), ice);
  water = (1.0 - land) * (1.0 - ice);
  // Settlements on the night side: sparse warm lights along coasts and lowlands
  float lights = step(0.86, hash12(floor(uv * vec2(900.0, 450.0)))) * land * (1.0 - ice);
  lights *= smoothstep(0.25, 0.0, elev) * smoothstep(-0.3, 0.6, t.b);
  emissive = vec3(1.0, 0.72, 0.4) * lights * 0.35 * (1.0 - smoothstep(-0.2, 0.05, NdL));
  // Auroral ovals ring both poles on the night side, rippling slowly.
  {
    float ring = exp(-pow((abs(lat) - 1.12 - 0.04 * sin(lon * 3.0 + uTime * 0.07)) / 0.05, 2.0));
    float ripple = 0.55 + 0.45 * vn(vec2(lon * 9.0 + uTime * 0.12, lat * 4.0));
    float darkSide = 1.0 - smoothstep(-0.25, 0.08, NdL);
    emissive += mix(vec3(0.2, 1.0, 0.62), vec3(0.55, 0.4, 1.0), ripple * 0.5) * ring * ripple * darkSide * 0.32;
  }

#elif KIND == K_DARK
  // Thin, sparse fissures: only the very crest of the vein field glows.
  float veins = max(smoothstep(0.62, 0.92, t.g), smoothstep(0.7, 0.95, t.a) * 0.6);
  albedo = mix(vec3(0.016, 0.015, 0.02), vec3(0.05, 0.047, 0.058), smoothstep(-0.4, 0.5, t.r));
  rough = 40.0;
  water = 0.25; // glassy sheen
  float pulse = 0.7 + 0.3 * sin(uTime * 0.6 + t.b * 6.0);
  vec3 veinCol = mix(uViolet, uIon, smoothstep(-0.5, 0.8, t.b));
  float night = 1.0 - smoothstep(-0.3, 0.2, NdL);
  emissive = veinCol * veins * pulse * (0.12 + night * 0.7);
  // Volcanic hot spots: a few places swell to a glow and fade over minutes.
  {
    vec2 cell = floor(uv * vec2(40.0, 20.0));
    float h = hash12(cell);
    vec2 f = fract(uv * vec2(40.0, 20.0)) - 0.5;
    float spot = exp(-dot(f, f) * 22.0) * step(0.93, h);
    float flare = smoothstep(0.55, 1.0, sin(uTime * (0.03 + h * 0.04) + h * 60.0));
    emissive += mix(uViolet, vec3(1.0, 0.55, 0.85), 0.35) * spot * flare * (0.05 + night * 0.55);
  }

#elif KIND == K_DESERT
  float basin = smoothstep(-0.2, -0.45, t.r);
  vec3 sand = mix(vec3(0.62, 0.42, 0.18), vec3(0.8, 0.6, 0.3), t.g);
  vec3 rock = mix(vec3(0.42, 0.22, 0.1), vec3(0.55, 0.32, 0.16), smoothstep(0.1, 0.6, t.r));
  albedo = mix(sand, rock, smoothstep(0.35, 0.7, t.b) * smoothstep(-0.05, 0.25, t.r));
  albedo = mix(albedo, vec3(0.84, 0.76, 0.62), basin * 0.8);       // salt flats
  albedo = mix(albedo, vec3(0.88, 0.86, 0.82), smoothstep(0.9, 0.97, abs(p.y))); // frost caps
  // Dust storms: soft ochre veils that drift east and slowly change shape.
  {
    vec2 sp = vec2(lon * 2.2 - uTime * 0.012, lat * 4.0);
    float storm = vn(sp) * 0.65 + vn(sp * 2.7 + vec2(uTime * 0.01, 3.1)) * 0.35;
    storm = smoothstep(0.58, 0.85, storm) * (1.0 - smoothstep(0.7, 1.1, abs(lat)));
    albedo = mix(albedo, vec3(0.74, 0.54, 0.32), storm * 0.6);
  }
  wrap = 0.05;

#elif KIND == K_CLOUD
  vec3 deep = vec3(0.2, 0.1, 0.38);
  vec3 lav = vec3(0.68, 0.56, 0.9);
  vec3 rose = vec3(0.72, 0.44, 0.62);
  albedo = mix(deep, lav, smoothstep(-0.3, 0.6, t.r));
  albedo = mix(albedo, rose, smoothstep(0.55, 1.0, t.g) * 0.55);
  albedo *= 0.85 + 0.25 * t.b;
  wrap = 0.25;
  // Lightning: brief flashes in random cells on the night side
  float night = 1.0 - smoothstep(-0.25, 0.1, NdL);
  vec2 cell = floor(uv * vec2(48.0, 24.0));
  float flash = step(0.9965, hash12(cell + floor(uTime * 3.0) * 1.37));
  emissive = vec3(0.75, 0.7, 1.0) * flash * night * smoothstep(0.0, 0.6, t.r) * 0.8;

#elif KIND == K_OCEAN
  float island = smoothstep(0.3, 0.33, t.r);
  vec3 abyss = vec3(0.002, 0.012, 0.035);
  vec3 current = vec3(0.01, 0.12, 0.16);
  vec3 sea = mix(abyss, current, smoothstep(-0.2, 0.55, t.g));
  sea *= 0.9 + 0.15 * t.b;
  vec3 rockCol = mix(vec3(0.05, 0.07, 0.05), vec3(0.16, 0.2, 0.1), smoothstep(0.33, 0.5, t.r));
  albedo = mix(sea, rockCol, island);
  water = 1.0 - island;
  rough = 110.0;
  // Bioluminescent currents on the night side
  float night = 1.0 - smoothstep(-0.25, 0.05, NdL);
  float glow = smoothstep(0.35, 0.7, t.g) * (0.5 + 0.5 * sin(uTime * 0.2 + t.b * 4.0));
  emissive = vec3(0.1, 0.85, 0.8) * glow * night * water * 0.06;

#elif KIND == K_GIANT
  vec3 cream = vec3(0.86, 0.78, 0.62);
  vec3 tan = vec3(0.7, 0.52, 0.34);
  vec3 brown = vec3(0.42, 0.27, 0.17);
  vec3 slate = vec3(0.5, 0.52, 0.58);
  float b = t.r + (t.g - 0.0) * 0.18;
  albedo = mix(brown, tan, smoothstep(0.15, 0.5, b));
  albedo = mix(albedo, cream, smoothstep(0.55, 0.85, b));
  albedo = mix(albedo, slate, smoothstep(0.75, 0.95, abs(p.y)) * 0.6);
  albedo *= 0.88 + 0.2 * t.b;
  // The great amber storm in the southern belt
  vec2 d = vec2((uv.x - 0.62) * 2.0, (uv.y - 0.33) * 5.0);
  float storm = exp(-dot(d, d) * 90.0);
  float swirl = sin(atan(d.y, d.x) * 2.0 + length(d) * 40.0 - uTime * 0.08) * 0.5 + 0.5;
  albedo = mix(albedo, mix(vec3(0.85, 0.42, 0.18), vec3(0.95, 0.68, 0.42), swirl), storm * 0.9);
  wrap = 0.12;
#endif

  // --- Lighting ----------------------------------------------------------
  float dayMask = smoothstep(-0.06 - wrap, 0.22, NdL);
  float diffuse = max((dot(Nb, L) + wrap) / (1.0 + wrap), 0.0) * dayMask;
#ifdef SUN2
  vec3 L2 = normalize(uSun2Pos - vWorldPos);
  float dayMask2 = smoothstep(-0.06 - wrap, 0.22, dot(N, L2));
  float diffuse2 = max((dot(Nb, L2) + wrap) / (1.0 + wrap), 0.0) * dayMask2;
#endif
#ifdef RINGS
  float through = ringShadow(vWorldPos, L);
  diffuse *= through;
#else
  float through = 1.0;
#endif
  // A moon's shadow on the day side (eclipses).
  float eclipse = moonShade(vWorldPos, L);
  diffuse *= eclipse;
  through *= eclipse;

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), rough) * water * dayMask * through;
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 5.0);

  vec3 color = albedo * uSunColor * diffuse * 1.9;
#ifdef SUN2
  color += albedo * uSun2Color * diffuse2 * 1.9;
#endif
  color += uSunColor * spec * (0.6 + fresnel);
  color += albedo * vec3(0.3, 0.38, 0.8) * 0.035;  // faint starlight fill
  color += emissive;

#if KIND == K_GIANT
  // Limb darkening on a gas giant
  color *= mix(0.55, 1.0, pow(max(dot(N, V), 0.0), 0.35));
#endif

  // Inner haze at grazing angles, tinted by the world's atmosphere
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  float daySide = smoothstep(-0.3, 0.6, NdL);
  vec3 haze = mix(uAtmoNight * 0.3, uAtmoDay, daySide);
  color = mix(color, color * 0.65 + haze * 0.5, rim * daySide * HAZE);
  color += haze * rim * (0.05 + daySide * 0.3) * HAZE;

  // Selection highlight: a whisper of rim light
  color += uAtmoDay * rim * uHighlight * 0.35;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** Cloud / dust deck sampled from the baked texture's alpha channel. */
export const worldCloudFragment = /* glsl */ `
uniform vec3 uSunPos;
uniform vec3 uSunColor;
#ifdef SUN2
// Phase 11: a second sun (Tessaly's binary).
uniform vec3 uSun2Pos;
uniform vec3 uSun2Color;
#endif
// Eclipses: a moon between this point and Elys casts a soft shadow (world space,
// the moons as drawn). Positions and radii come from Moons.tsx; w = 0 is unused.
uniform vec4 uMoonShadow[5];
float moonShade(vec3 p, vec3 L) {
  float s = 1.0;
  for (int i = 0; i < 5; i++) {
    vec4 m = uMoonShadow[i];
    if (m.w <= 0.0) continue;
    vec3 toM = m.xyz - p;
    float t = dot(toM, L);
    if (t <= 0.0) continue;
    float d = length(toM - L * t);
    float pen = m.w * 0.35 + t * 0.012;
    s *= mix(0.1, 1.0, smoothstep(m.w - pen, m.w + pen, d));
  }
  return s;
}

uniform sampler2D uTerrain;
uniform float uTime;
uniform float uSpeed;
uniform vec3 uCloudColor;
uniform float uOpacity;
uniform vec3 uAtmoDay;
uniform float uStorms;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

const float PI = 3.141592653589793;

/** Phase 7: a cyclone — a spiral of cloud around a clear eye, turning. */
float cyclone(vec2 uv, vec2 c, float r, float t) {
  vec2 d = (uv - c) * vec2(2.0, 1.0);
  float dist = length(d);
  if (dist > r) return 0.0;
  float a = atan(d.y, d.x) - t + dist / r * 9.0;
  float arms = 0.5 + 0.5 * sin(a * 2.0);
  float eye = smoothstep(r * 0.05, r * 0.14, dist);
  return arms * eye * (1.0 - smoothstep(r * 0.4, r, dist));
}

void main() {
  vec3 p = normalize(vObjPos);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5 + uTime * uSpeed, lat / PI + 0.5);
  float d = texture2D(uTerrain, uv).a;
  // Wide, soft ramp so cloud edges feather instead of cutting like brush strokes.
  float cover = smoothstep(-0.05, 0.6, d);
  if (uStorms > 0.0) {
    // Cyclones turn where they are (anticlockwise north, clockwise south) and drift with the clouds.
    float s = cyclone(uv, vec2(0.3, 0.33), 0.12, uTime * 0.05);
    s = max(s, cyclone(uv, vec2(0.74, 0.7), 0.09, -uTime * 0.06));
    s = max(s, cyclone(uv, vec2(1.05, 0.38), 0.07, uTime * 0.07) * uStorms);
    cover = max(cover, s * uStorms);
  }
  cover *= cover * smoothstep(1.0, 0.6, abs(p.y) * 0.9 + 0.1);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdL = dot(N, L);
  float lit = smoothstep(-0.08, 0.45, NdL) * moonShade(vWorldPos, L);
  float forward = pow(max(dot(-V, L), 0.0), 4.0) * pow(1.0 - max(dot(N, V), 0.0), 2.0);

  vec3 col = mix(vec3(0.006, 0.01, 0.025), uCloudColor * uSunColor, lit);
#ifdef SUN2
  float lit2 = smoothstep(-0.08, 0.45, dot(N, normalize(uSun2Pos - vWorldPos)));
  col += uCloudColor * uSun2Color * lit2;
  lit = max(lit, lit2);
#endif
  col += mix(uAtmoDay, vec3(1.0), 0.5) * forward * smoothstep(-0.25, 0.1, NdL) * 0.6;
  gl_FragColor = vec4(col, cover * uOpacity * (0.65 + 0.35 * lit));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** Atmosphere shell lit by a point star. Same closest-approach model as Vael's. */
export const worldAtmosphereFragment = /* glsl */ `
uniform vec3 uCenter;
uniform float uRadius;
uniform float uShell;
uniform float uDensity;
uniform vec3 uSunPos;
uniform vec3 uDay;
uniform vec3 uNight;
uniform float uIntensity;
#ifdef SUN2
// Phase 11: a second sun (Tessaly's binary).
uniform vec3 uSun2Pos;
uniform vec3 uSun2Color;
#endif

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 ro = (cameraPosition - uCenter) / uRadius;
  vec3 rd = normalize(vWorldPos - cameraPosition);
  float tc = max(-dot(ro, rd), 0.0);
  vec3 pc = ro + rd * tc;
  float b = length(pc);
  float alt = max(b - 1.0, 0.0);
  float span = uShell - 1.0;

  float dense = exp(-alt / (span * uDensity));
  float halo = exp(-alt / (span * 0.55)) * 0.12;
  float glow = (dense + halo) * smoothstep(uShell, uShell - span * 0.35, b);

  vec3 L = normalize(uSunPos - (uCenter + pc * uRadius));
  float day = smoothstep(-0.35, 0.65, dot(normalize(pc), L));
  float mie = pow(max(dot(rd, L), 0.0), 7.0);

#ifdef SUN2
  // Two suns: each lights its own side of the shell; the day side is the brighter of them.
  vec3 L2 = normalize(uSun2Pos - (uCenter + pc * uRadius));
  float day2 = smoothstep(-0.35, 0.65, dot(normalize(pc), L2));
  mie += pow(max(dot(rd, L2), 0.0), 7.0) * 0.7;
  day = max(day, day2 * 0.85);
#endif
  vec3 col = mix(uNight * 0.6, uDay, day) * glow * (0.22 + 1.2 * day);
  col += uDay * glow * mie * 0.7;
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`

// ---------------------------------------------------------------------------
// Rings
// ---------------------------------------------------------------------------

export const ringVertex = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorldPos;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const ringFragment = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform vec3 uSunPos;
uniform vec3 uSunColor;
uniform vec3 uCenter;
uniform float uPlanetR;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uTime;

varying vec3 vLocal;
varying vec3 vWorldPos;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), smoothstep(0.0, 1.0, f));
}

void main() {
  float r = length(vLocal.xy);
  float x = (r - uInner) / (uOuter - uInner);
  if (x < 0.0 || x > 1.0) discard;

  float bands = noise1(x * 70.0) * 0.45 + noise1(x * 210.0) * 0.25 + noise1(x * 14.0) * 0.5;
  float gap = smoothstep(0.6, 0.615, x) * (1.0 - smoothstep(0.655, 0.67, x));
  float density = clamp(bands, 0.0, 1.0) * (1.0 - gap * 0.92);
  density *= smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.9, 1.0, x));
  // Phase 7: the rings turn — clumps orbit, the inner ones faster (Kepler: r^-1.5).
  float ang = atan(vLocal.y, vLocal.x) + uTime * 0.02 * pow(r / uInner, -1.5);
  density *= 0.8 + 0.2 * noise1(ang * 30.0 + floor(x * 40.0) * 7.0);

  vec3 col = mix(uColorB, uColorA, noise1(x * 34.0 + 3.0));

  // Planet shadow: does the path to the star pass through the planet?
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 oc = vWorldPos - uCenter;
  float bq = dot(oc, L);
  float c = dot(oc, oc) - uPlanetR * uPlanetR;
  float h = bq * bq - c;
  float shadow = (h > 0.0 && -bq - sqrt(max(h, 0.0)) > 0.0) ? 0.08 : 1.0;

  vec3 V = normalize(vWorldPos - cameraPosition);
  float forward = pow(max(dot(V, L), 0.0), 5.0);
  vec3 lit = col * uSunColor * (0.55 + forward * 1.4) * shadow;

  float a = density * uOpacity;
  gl_FragColor = vec4(lit, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------------------
// Elys, the system's star
// ---------------------------------------------------------------------------

export const starFragment = /* glsl */ `
uniform float uTime;
// Phase 11: a star's own colours (Elys's by default; Tessaly's two suns differ).
uniform vec3 uHot;
uniform vec3 uWarm;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${noiseGLSL}
void main() {
  vec3 p = normalize(vObjPos);
  float n = fbm(p * 3.2 + vec3(0.0, uTime * 0.02, 0.0));
  float g = fbm(p * 12.0 + n * 1.6 - vec3(uTime * 0.015));
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = max(dot(N, V), 0.0);
  float limb = pow(mu, 0.5);
  vec3 col = mix(uWarm, uHot, limb * 0.85 + g * 0.2);
  col *= (2.6 + g * 1.4 + n * 0.6) * mix(0.55, 1.0, limb);
  gl_FragColor = vec4(col, 1.0);
}
`

export const coronaVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const coronaFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  float a = atan(c.y, c.x);
  float streamers = 0.75 + 0.25 * sin(a * 7.0 + uTime * 0.05) * sin(a * 3.0 - uTime * 0.03);
  float glow = exp(-d * 5.5) * 1.6 + exp(-d * 2.2) * 0.35 * streamers + exp(-d * 1.0) * 0.06;
  glow *= smoothstep(1.0, 0.7, d);
  gl_FragColor = vec4(uColor * glow, glow);
}
`

// ---------------------------------------------------------------------------
// The spiral galaxy around the system
// ---------------------------------------------------------------------------

export const galaxyDiscVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uFade;
uniform float uMap;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Phase 11: on the universe map the whole disc is far away; stars keep a size that reads as arms.
  gl_PointSize = clamp(aSize * uPixelRatio * (320.0 / -mv.z) * (1.0 + uMap * 2.2), 1.0, 6.0 * uPixelRatio);
  vColor = aColor * uFade;
}
`

export const galaxyDiscFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 16.0);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`

// ---------------------------------------------------------------------------
// Warp streaks (camera space)
// ---------------------------------------------------------------------------

export const warpVertex = /* glsl */ `
attribute vec3 aSeed;   // x, y in the tunnel, z start depth
attribute float aEnd;   // 0 = head, 1 = tail
uniform float uTime;
uniform float uWarp;
varying float vAlpha;
void main() {
  float range = 120.0;
  float z = -mod(aSeed.z + uTime * 140.0, range) - 2.0;
  z -= aEnd * (2.0 + uWarp * 26.0);
  vec3 pos = vec3(aSeed.xy, z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  float depthFade = smoothstep(-range, -range * 0.6, z) * smoothstep(-1.0, -10.0, z);
  vAlpha = uWarp * depthFade * (1.0 - aEnd * 0.9);
}
`

export const warpFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor * vAlpha, vAlpha);
}
`
