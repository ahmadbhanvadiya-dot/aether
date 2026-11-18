import { noiseGLSL } from './noise'

/** Shared vertex shader for every sphere layer of Vael. */
export const sphereVertex = /* glsl */ `
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

/**
 * Terrain bake: evaluates Vael's terrain once into an equirectangular
 * half-float texture. R = height fBm, G = ridges, B = mineral variation,
 * A = ice-edge noise. Noise is evaluated on the 3D sphere, so there is no seam.
 */
export const terrainBakeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const terrainBakeFragment = /* glsl */ `
varying vec2 vUv;
${noiseGLSL}
void main() {
  const float PI = 3.141592653589793;
  float lon = vUv.x * 2.0 * PI - PI;
  float lat = (vUv.y - 0.5) * PI;
  vec3 p = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));

  vec3 q = p * 1.45;
  vec3 warp = vec3(
    snoise(q * 0.9 + vec3(1.7, 9.2, 3.1)),
    snoise(q * 0.9 + vec3(8.3, 2.8, 5.5)),
    snoise(q * 0.9 + vec3(4.1, 6.3, 1.9))
  );
  float h = fbm(q + warp * 0.55);
  float ridge = ridged(p * 3.4 + warp * 0.3);
  float mineral = snoise(p * 11.0 + warp);
  float iceNoise = snoise(p * 7.0);
  gl_FragColor = vec4(h, ridge, mineral, iceNoise);
}
`

/**
 * Vael's surface, lit from the baked terrain: ocean/land/ice albedo, smooth
 * normals from texture finite differences, ocean glint, a scattering tint
 * along the terminator, and faint bioluminescent coastlines on the night side.
 */
export const planetFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uIon;
uniform vec3 uViolet;
uniform float uTime;
uniform sampler2D uTerrain;
uniform vec2 uTexel;
uniform mat3 uModelRot;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${noiseGLSL}

const float PI = 3.141592653589793;
const float SEA = 0.03;

vec4 terrainAt(vec2 uv) {
  return texture2D(uTerrain, uv);
}

float heightOf(vec4 t) {
  float land = smoothstep(SEA - 0.004, SEA + 0.018, t.r);
  float elev = max(t.r - SEA, 0.0);
  return land * (elev * 1.6 + t.g * t.g * 0.22);
}

void main() {
  vec3 p = normalize(vObjPos);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);

  vec4 t = terrainAt(uv);
  float h = t.r;
  float ridge = t.g;

  float land = smoothstep(SEA - 0.004, SEA + 0.018, h);
  float elev = max(h - SEA, 0.0);
  float ice = smoothstep(0.86, 0.95, abs(p.y) + t.a * 0.04 + elev * 0.35);

  // --- Albedo ------------------------------------------------------------
  vec3 deep = vec3(0.006, 0.016, 0.055);
  vec3 shallow = vec3(0.02, 0.075, 0.17);
  vec3 ocean = mix(deep, shallow, smoothstep(-0.28, SEA, h));

  vec3 lowland = vec3(0.07, 0.075, 0.09);
  vec3 midland = vec3(0.15, 0.125, 0.15);
  vec3 highland = vec3(0.36, 0.33, 0.35);
  vec3 landCol = mix(lowland, midland, smoothstep(0.0, 0.16, elev));
  landCol = mix(landCol, highland, smoothstep(0.12, 0.36, elev + ridge * 0.12));
  landCol *= 0.82 + 0.28 * t.b;

  vec3 albedo = mix(ocean, landCol, land);
  albedo = mix(albedo, vec3(0.74, 0.8, 0.88), ice);

  // --- Normal from the baked height field --------------------------------
  float hE = heightOf(terrainAt(uv + vec2(uTexel.x, 0.0)));
  float hW = heightOf(terrainAt(uv - vec2(uTexel.x, 0.0)));
  float hN = heightOf(terrainAt(uv + vec2(0.0, uTexel.y)));
  float hS = heightOf(terrainAt(uv - vec2(0.0, uTexel.y)));
  float cosLat = max(cos(lat), 0.05);
  // Height change per unit of arc length, east and north.
  float dE = (hE - hW) / (2.0 * uTexel.x * 2.0 * PI * cosLat);
  float dN = (hN - hS) / (2.0 * uTexel.y * PI);
  vec3 east = vec3(-sin(lon), 0.0, cos(lon));
  vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), -sin(lat) * sin(lon));
  float bumpStrength = 0.075 * (1.0 - ice * 0.6);
  vec3 nObj = normalize(p - bumpStrength * (dE * east + dN * north));
  vec3 Nb = normalize(uModelRot * nObj);

  // --- Lighting ----------------------------------------------------------
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdLgeo = dot(N, L);

  float dayMask = smoothstep(-0.06, 0.22, NdLgeo);
  float diffuse = max(dot(Nb, L), 0.0) * dayMask;

  // Ocean glint
  vec3 H = normalize(L + V);
  float water = (1.0 - land) * (1.0 - ice);
  float spec = pow(max(dot(N, H), 0.0), 160.0) * water * dayMask;
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 5.0);

  vec3 color = albedo * uSunColor * diffuse * 2.1;
  color += uSunColor * spec * (0.7 + fresnel * 1.2);

  // Scattering tint where day turns to night
  float term = smoothstep(-0.14, 0.0, NdLgeo) * (1.0 - smoothstep(0.0, 0.2, NdLgeo));
  color += vec3(0.42, 0.24, 0.55) * term * 0.05;

  // Starlight fill so the night side is never a flat black hole
  color += albedo * vec3(0.35, 0.45, 0.9) * 0.05;

  // Bioluminescent coastlines on the night side: thin, sparse, slowly pulsing
  float night = 1.0 - smoothstep(-0.25, 0.02, NdLgeo);
  float coast = 1.0 - smoothstep(0.0, 0.012, abs(h - SEA));
  float bloomNoise = smoothstep(0.25, 0.9, snoise(p * 18.0 + vec3(0.0, uTime * 0.02, 0.0)));
  color += uIon * coast * bloomNoise * night * (1.0 - ice) * 0.07;

  // Inner atmosphere haze at grazing angles
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  float daySide = smoothstep(-0.3, 0.6, NdLgeo);
  vec3 haze = mix(uViolet * 0.28, mix(uIon, vec3(0.75, 0.88, 1.0), 0.25), daySide);
  color = mix(color, color * 0.6 + haze * 0.55, rim * daySide * 0.7);
  color += haze * rim * (0.08 + daySide * 0.35);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** A thin, faster-moving cloud deck. */
export const cloudFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uIon;
uniform float uTime;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${noiseGLSL}

void main() {
  vec3 p = normalize(vObjPos);
  float a = uTime * 0.006;
  float c = cos(a), s = sin(a);
  p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);

  vec3 q = p * vec3(2.1, 4.2, 2.1);
  vec3 warp = vec3(snoise(q * 0.7 + 3.1), snoise(q * 0.7 + 7.7), snoise(q * 0.7 + 1.3));
  float d = fbm(q + warp * 0.8 + vec3(0.0, 0.0, uTime * 0.004));
  float cover = smoothstep(0.1, 0.5, d);
  // Thin out clouds at the poles, thicken along storm latitudes
  cover *= 0.55 + 0.45 * smoothstep(0.95, 0.35, abs(p.y));

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdL = dot(N, L);
  float lit = smoothstep(-0.08, 0.45, NdL);

  // Silver lining when the sun is behind the planet
  float forward = pow(max(dot(-V, L), 0.0), 4.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  float lining = forward * rim * smoothstep(-0.25, 0.1, NdL);

  vec3 nightCol = vec3(0.008, 0.012, 0.03);
  vec3 dayCol = uSunColor * 0.95;
  vec3 col = mix(nightCol, dayCol, lit) + mix(uIon, vec3(1.0), 0.5) * lining * 0.8;

  float alpha = cover * (0.62 + 0.26 * lit);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/**
 * Atmosphere shell, rendered from the back faces with additive blending.
 *
 * Instead of a view-angle fresnel (which balloons when the camera gets close),
 * each fragment computes the closest approach of its view ray to the planet's
 * centre. Glow is a function of that altitude above the surface, so the limb
 * stays a thin, physically scaled band from far orbit down to the horizon shot.
 */
export const atmosphereFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uIon;
uniform vec3 uViolet;
uniform float uShell;
uniform float uIntensity;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 L = normalize(uSunDir);
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - ro);

  // Closest approach of the view ray to the planet centre (origin).
  float tc = max(-dot(ro, rd), 0.0);
  vec3 pc = ro + rd * tc;
  float b = length(pc);
  float alt = max(b - 1.0, 0.0);
  float span = uShell - 1.0;

  // Dense, thin scattering layer + a soft outer halo, fading out at the shell.
  float dense = exp(-alt / (span * 0.16));
  float halo = exp(-alt / (span * 0.5)) * 0.11;
  float glow = (dense + halo) * smoothstep(uShell, uShell - span * 0.35, b);

  vec3 up = normalize(pc);
  float day = smoothstep(-0.35, 0.65, dot(up, L));
  float mie = pow(max(dot(rd, L), 0.0), 7.0);

  vec3 dayCol = mix(uIon, vec3(0.8, 0.9, 1.0), 0.28);
  vec3 col = mix(uViolet * 0.55, dayCol, day) * glow * (0.28 + 1.25 * day);
  col += mix(uIon, uViolet, 0.25) * glow * mie * 0.8;

  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`
