import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groveNoise, heightAt, pathX } from './layout.js';
import { withMist } from './mist.js';

// Low-poly trees built from a few primitives, with irregular vertices, baked
// shading (darker undersides, lighter tips), per-tree tint and a little wind.

const colors = {
  trunk: new Color('#3b2a27'),
  pineDark: new Color('#173329'),
  pineLight: new Color('#4f8060'),
  leafDark: new Color('#2c3a25'),
  leafLight: new Color('#8c8248'),
};

// Displace each distinct vertex position by the same amount wherever it is
// repeated, so the jitter never tears the surface open.
function jitter(geometry, rand, amount, { keepBase = false } = {}) {
  const pos = geometry.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!offsets.has(key)) offsets.set(key, [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount]);
    const [dx, dy, dz] = offsets.get(key);
    pos.setXYZ(i, x + dx, keepBase && y <= 0.0001 ? y : y + dy, z + dz);
  }
}

function paint(geometry, shade) {
  const pos = geometry.attributes.position;
  const data = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    shade(c, pos.getX(i), pos.getY(i), pos.getZ(i));
    data.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(data, 3));
}

// Faceted look from baked per-face normals rather than flatShading, whose
// screen-space derivatives can produce NaN pixels on tiny distant instances.
function finish(parts) {
  const geometry = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  geometry.computeBoundingBox();
  const h = geometry.boundingBox.max.y;
  geometry.scale(1 / h, 1 / h, 1 / h);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function trunk(rand, height, radius) {
  const g = new CylinderGeometry(radius * 0.6, radius, height, 6, 1);
  g.translate(0, height / 2, 0);
  jitter(g, rand, radius * 0.4, { keepBase: true });
  paint(g, (c, x, y) => c.copy(colors.trunk).multiplyScalar(0.6 + 0.4 * (y / height)));
  return g;
}

function pine(rand, tiers, girth) {
  const parts = [trunk(rand, 0.5, 0.11 * girth)];
  let base = 0.3;
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1);
    const radius = (0.66 - 0.4 * t) * girth;
    const height = 0.7 - 0.2 * t;
    const g = new ConeGeometry(radius, height, 8, 2);
    g.rotateY(rand() * Math.PI);
    // Droop the lower rim and make each tier a little lopsided.
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const rim = y < -height / 2 + 0.001 ? 1 : 0;
      pos.setY(i, y - rim * 0.06);
    }
    jitter(g, rand, radius * 0.22);
    g.translate((rand() - 0.5) * 0.04, base + height / 2, (rand() - 0.5) * 0.04);
    const b = base;
    paint(g, (c, x, y) => {
      const up = Math.min(1, Math.max(0, (y - b) / height));
      c.copy(colors.pineDark).lerp(colors.pineLight, 0.15 + up * 0.55 + t * 0.25);
      c.multiplyScalar(0.55 + up * 0.45);
    });
    parts.push(g);
    base += height * 0.48;
  }
  return finish(parts);
}

function broadleaf(rand) {
  const parts = [trunk(rand, 0.55, 0.09)];
  const blobs = [
    [0, 0.78, 0, 0.42],
    [0.2, 0.62, 0.1, 0.32],
    [-0.18, 0.66, -0.08, 0.34],
    [0.04, 0.98, -0.04, 0.3],
  ];
  for (const [x, y, z, r] of blobs) {
    const g = new IcosahedronGeometry(r, 1);
    jitter(g, rand, r * 0.35);
    g.scale(1, 0.85, 1);
    g.translate(x, y, z);
    paint(g, (c, px, py) => {
      const up = Math.min(1, Math.max(0, (py - (y - r)) / (2 * r)));
      c.copy(colors.leafDark).lerp(colors.leafLight, up * 0.75);
      c.multiplyScalar(0.55 + up * 0.5);
    });
    parts.push(g);
  }
  return finish(parts);
}

export function createForest({ count, zStart, zEnd, isClear, rand, sunDirection, sunColor }) {
  const time = { value: 0 };
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uSunDir = { value: sunDirection };
    shader.uniforms.uSunColor = { value: sunColor };
    // Backlit rim: edges glow warm when the sun is behind the tree, the way
    // needles catch light at golden hour.
    shader.fragmentShader = `uniform vec3 uSunDir;\nuniform vec3 uSunColor;\n${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      vec3 toCamera = normalize(vViewPosition);
      vec3 sunView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
      float backlit = pow(max(dot(-toCamera, sunView), 0.0), 4.0);
      float rim = pow(1.0 - clamp(dot(normal, toCamera), 0.0, 1.0), 4.0);
      outgoingLight += uSunColor * rim * (0.02 + backlit * 0.28) * (0.5 + diffuseColor.g);
      #include <opaque_fragment>`,
    );
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 rootPos = instanceMatrix[3].xyz;
      #else
        vec3 rootPos = vec3(0.0);
      #endif
      float bend = position.y * position.y;
      float phase = uTime * 1.1 + rootPos.x * 0.21 + rootPos.z * 0.17;
      transformed.x += bend * (sin(phase) * 0.03 + sin(phase * 2.7) * 0.01);
      transformed.z += bend * cos(phase * 0.8) * 0.022;`,
    );
  };

  withMist(material);

  const kinds = [
    { geometry: pine(rand, 5, 0.85), share: 0.4, height: [4.5, 9], width: [0.75, 1] },
    { geometry: pine(rand, 4, 1.1), share: 0.35, height: [3, 6.5], width: [0.85, 1.15] },
    { geometry: broadleaf(rand), share: 0.25, height: [2.6, 4.6], width: [0.9, 1.25], low: true },
  ];
  const meshes = kinds.map((k) => {
    const mesh = new InstancedMesh(k.geometry, material, Math.ceil(count * k.share * 1.2));
    mesh.count = 0;
    return mesh;
  });

  const dummy = new Object3D();
  const tint = new Color();
  for (let tries = 0, placed = 0; placed < count && tries < count * 12; tries++) {
    const z = zStart + (zEnd - zStart) * rand();
    const d = 7 + Math.pow(rand(), 0.8) * 72;
    const x = pathX(z) + (rand() < 0.5 ? -1 : 1) * d;
    const y = heightAt(x, z);
    if (y > 24 || !isClear(x, z)) continue;
    // Groves: dense where the noise is high, open clearings where it is low.
    if (rand() > 0.15 + Math.max(0, groveNoise(x, z) + 0.15) * 2.4) continue;

    const roll = rand();
    let kind = roll < kinds[0].share ? 0 : roll < kinds[0].share + kinds[1].share ? 1 : 2;
    if (kind === 2 && d > 30) kind = 1;
    const spec = kinds[kind];
    const mesh = meshes[kind];
    if (mesh.count >= mesh.instanceMatrix.count) continue;

    const h = spec.height[0] + rand() * (spec.height[1] - spec.height[0]);
    const w = h * (spec.width[0] + rand() * (spec.width[1] - spec.width[0]));
    // Plant at the lowest point under the trunk so nothing floats on slopes.
    const base = Math.min(y, heightAt(x + 0.8, z), heightAt(x - 0.8, z), heightAt(x, z + 0.8), heightAt(x, z - 0.8));
    dummy.position.set(x, base - 0.2, z);
    dummy.rotation.set((rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count, dummy.matrix);
    const warmth = (rand() - 0.5) * 0.16;
    tint.setRGB(1 + warmth, 1, 1 - warmth).multiplyScalar(0.8 + rand() * 0.35);
    mesh.setColorAt(mesh.count, tint);
    mesh.count++;
    placed++;
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return {
    meshes,
    update(t) {
      time.value = t;
    },
  };
}
