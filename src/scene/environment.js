import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderChunk,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { heightAt, pathX, pathEndZ } from './layout.js';

export const palette = {
  fog: new Color('#4e2f5e'),
  fogSun: new Color('#e0745a'),
  skyMid: new Color('#2a2058'),
  skyTop: new Color('#070820'),
  sunset: new Color('#ff9a5c'),
  sun: new Color('#ffe0b0'),
  floor: new Color('#2a2238'),
  slope: new Color('#3d3052'),
  high: new Color('#7a6690'),
  tree: new Color('#16111f'),
  rock: new Color('#2c2536'),
  river: new Color('#ffb27a'),
  firefly: new Color('#ffcf8a'),
};

export const sunDirection = new Vector3(0.12, 0.07, -1).normalize();

const glsl = (v) => `vec3(${v.toArray().map((n) => n.toFixed(4)).join(', ')})`;

// Replace three's fog with a version that warms toward the sun, so distant
// ridges fade into the same colour as the sky behind them.
export function installSunFog() {
  ShaderChunk.fog_pars_vertex = /* glsl */ `
    #ifdef USE_FOG
      varying float vFogDepth;
      varying vec3 vFogWorldDir;
    #endif`;
  ShaderChunk.fog_vertex = /* glsl */ `
    #ifdef USE_FOG
      vFogDepth = - mvPosition.z;
      vec4 fogWorldPos = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        fogWorldPos = instanceMatrix * fogWorldPos;
      #endif
      fogWorldPos = modelMatrix * fogWorldPos;
      vFogWorldDir = fogWorldPos.xyz - cameraPosition;
    #endif`;
  ShaderChunk.fog_pars_fragment = /* glsl */ `
    #ifdef USE_FOG
      uniform vec3 fogColor;
      varying float vFogDepth;
      varying vec3 vFogWorldDir;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
    #endif`;
  ShaderChunk.fog_fragment = /* glsl */ `
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
      #else
        float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
      #endif
      float fogSun = pow( max( dot( normalize( vFogWorldDir ), ${glsl(sunDirection)} ), 0.0 ), 5.0 );
      vec3 fogTint = mix( fogColor, ${glsl(palette.fogSun)}, fogSun );
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );
    #endif`;
}

export function createSky() {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDirection },
      uFog: { value: palette.fog },
      uFogSun: { value: palette.fogSun },
      uMid: { value: palette.skyMid },
      uTop: { value: palette.skyTop },
      uSunset: { value: palette.sunset },
      uSun: { value: palette.sun },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir, uFog, uFogSun, uMid, uTop, uSunset, uSun;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sunAmt = max(dot(d, uSunDir), 0.0);

        // Horizon colour matches the fog exactly, so the land melts into the sky.
        vec3 horizonDir = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
        float fogSun = pow(max(dot(horizonDir, uSunDir), 0.0), 5.0);
        vec3 horizon = mix(uFog, uFogSun, fogSun);

        vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uTop, smoothstep(0.22, 0.8, h));
        col += uSunset * pow(sunAmt, 4.0) * 0.3 * (1.0 - smoothstep(0.0, 0.5, h));
        col += uSun * pow(sunAmt, 32.0) * 0.45;
        col += uSun * smoothstep(0.9993, 0.99965, sunAmt) * 5.0;

        vec3 sp = d * 380.0;
        float s = hash(floor(sp));
        float star = step(0.9962, s) * smoothstep(0.1, 0.45, h);
        star *= smoothstep(0.32, 0.0, length(fract(sp) - 0.5));
        star *= 0.55 + 0.45 * sin(uTime * 1.7 + s * 120.0);
        col += vec3(0.9, 0.92, 1.0) * star * 1.6;

        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new Mesh(new SphereGeometry(1500, 48, 24), material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Deterministic pseudo-random so the landscape is identical on every load.
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTerrain(count, quality) {
  const zStart = 140;
  const zEnd = pathEndZ(count) - 420;
  const depth = zStart - zEnd;
  const width = 700;
  const cell = quality === 'low' ? 5 : 3.4;
  const geometry = new PlaneGeometry(width, depth, Math.round(width / cell), Math.round(depth / cell));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, zStart - depth / 2);

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rand = random(7);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (rand() - 0.5) * cell * 0.6;
    const z = pos.getZ(i) + (rand() - 0.5) * cell * 0.6;
    const y = heightAt(x, z);
    pos.setXYZ(i, x, y, z);

    const t = y / 48;
    c.copy(palette.floor).lerp(palette.slope, smoothstep(0.02, 0.25, t)).lerp(palette.high, smoothstep(0.35, 1.0, t));
    c.multiplyScalar(0.92 + rand() * 0.16);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  return new Mesh(geometry, material);
}

export function createVegetation(count, beacons, quality) {
  const rand = random(21);
  const zStart = 120;
  const zEnd = pathEndZ(count) - 200;
  const dummy = new Object3D();
  // Keep each monument's surroundings and its sightline from the path empty.
  const segmentDistance = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
  };
  const clear = (x, z) =>
    beacons.every((b) => {
      const { x: bx, z: bz } = b.position;
      const vz = bz + 24;
      return Math.hypot(bx - x, bz - z) > 9 && segmentDistance(x, z, bx, bz, pathX(vz), vz) > 6;
    });

  // Faceted look from baked per-face normals rather than flatShading, whose
  // screen-space derivatives can produce NaN pixels on tiny distant instances.
  const treeGeo = new ConeGeometry(1, 1, 6, 1).toNonIndexed();
  treeGeo.translate(0, 0.5, 0);
  treeGeo.computeVertexNormals();
  const treeTarget = quality === 'low' ? 1100 : 2600;
  const trees = new InstancedMesh(
    treeGeo,
    new MeshStandardMaterial({ color: palette.tree, roughness: 1 }),
    treeTarget,
  );
  let placed = 0;
  for (let tries = 0; placed < treeTarget && tries < treeTarget * 8; tries++) {
    const z = zStart + (zEnd - zStart) * rand();
    const x = pathX(z) + (rand() < 0.5 ? -1 : 1) * (8 + rand() * 70);
    const y = heightAt(x, z);
    if (y > 22 || !clear(x, z)) continue;
    const h = 2.4 + rand() * 4.2;
    const r = h * (0.22 + rand() * 0.08);
    dummy.position.set(x, y - 0.3, z);
    dummy.rotation.set((rand() - 0.5) * 0.1, rand() * Math.PI, (rand() - 0.5) * 0.1);
    dummy.scale.set(r, h, r);
    dummy.updateMatrix();
    trees.setMatrixAt(placed++, dummy.matrix);
  }
  trees.count = placed;

  const rockTarget = quality === 'low' ? 160 : 420;
  const rocks = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: palette.rock, roughness: 0.9 }),
    rockTarget,
  );
  for (let i = 0; i < rockTarget; i++) {
    const z = zStart + (zEnd - zStart) * rand();
    const x = pathX(z) + (rand() < 0.5 ? -1 : 1) * (3.5 + rand() * 30);
    const s = 0.25 + Math.pow(rand(), 2.5) * 1.8;
    dummy.position.set(x, heightAt(x, z) - s * 0.3, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(s * (0.8 + rand() * 0.6), s * (0.5 + rand() * 0.5), s * (0.8 + rand() * 0.6));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  return [trees, rocks];
}

// A thin ribbon of light running along the valley floor, guiding the eye.
export function createRiver(count) {
  const zStart = 60;
  const zEnd = pathEndZ(count) - 60;
  const step = 1.2;
  const width = 1.3;
  const rows = Math.ceil((zStart - zEnd) / step) + 1;
  const positions = new Float32Array(rows * 2 * 3);
  const uvs = new Float32Array(rows * 2 * 2);
  const index = [];
  let dist = 0;
  let prev = null;
  for (let r = 0; r < rows; r++) {
    const z = zStart - r * step;
    const x = pathX(z);
    const nz = z - 0.5;
    const tx = pathX(nz) - x;
    const len = Math.hypot(tx, 0.5);
    const px = (0.5 / len) * width;
    const pz = (tx / len) * width;
    const y = heightAt(x, z) + 0.3;
    if (prev) dist += Math.hypot(x - prev[0], z - prev[1]);
    prev = [x, z];
    positions.set([x - px, y, z - pz, x + px, y, z + pz], r * 6);
    uvs.set([0, dist, 1, dist], r * 4);
    if (r < rows - 1) {
      const a = r * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(index);

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: palette.river } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFade;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        vFade = exp(-pow(d * 0.008, 2.0)) * smoothstep(3.0, 18.0, d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vFade;
      void main() {
        float across = abs(vUv.x - 0.5) * 2.0;
        float core = exp(-across * across * 18.0);
        float halo = exp(-across * across * 3.0) * 0.25;
        float pulse = pow(0.5 + 0.5 * sin(vUv.y * 0.22 - uTime * 2.2), 10.0);
        float shimmer = 0.75 + 0.25 * sin(vUv.y * 1.7 + uTime * 3.0);
        float a = (core * (0.35 + pulse * 1.0) * shimmer + halo) * vFade;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  return new Mesh(geometry, material);
}

export function createFireflies(count, quality) {
  const total = quality === 'low' ? 900 : 2200;
  const rand = random(99);
  const zStart = 80;
  const zEnd = pathEndZ(count) - 40;
  const positions = new Float32Array(total * 3);
  const seeds = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const z = zStart + (zEnd - zStart) * rand();
    const x = pathX(z) + (rand() - 0.5) * 2 * (3 + Math.pow(rand(), 1.5) * 36);
    positions.set([x, heightAt(x, z) + 0.6 + Math.pow(rand(), 1.8) * 10, z], i * 3);
    seeds[i] = rand();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uColor: { value: palette.firefly },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uPixelRatio;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.4 + aSeed * 0.5);
        p += vec3(sin(t + aSeed * 31.0) * 0.9, sin(t * 1.3 + aSeed * 17.0) * 0.6, cos(t * 0.8 + aSeed * 11.0) * 0.9);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = (16.0 + aSeed * 22.0) * uPixelRatio / d;
        vAlpha = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 2.5) + aSeed * 50.0), 3.0))
          * exp(-pow(d * 0.012, 2.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 2.0) * vAlpha;
        gl_FragColor = vec4(uColor * a * 1.6, a);
      }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}
