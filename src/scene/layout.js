import { CatmullRomCurve3, Vector3 } from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// Shared geometry of the valley: the winding path, the terrain height field,
// and where each project beacon stands. Everything else reads from here so the
// camera, terrain, river and beacons always agree.

export const FIRST_Z = -90;
export const SPACING = 80;
export const BEACON_OFFSET = 12;
export const CAMERA_HEIGHT = 3.2;

const perlin = new ImprovedNoise();

function fbm(x, z, octaves, seed) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * perlin.noise(x * freq, z * freq, seed + o * 13.1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function ridged(x, z) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < 5; o++) {
    const n = 1 - Math.abs(perlin.noise(x * freq, z * freq, 7.3 + o * 5.7));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Low-frequency field used to cluster vegetation into groves and clearings.
export function groveNoise(x, z) {
  return fbm(x * 0.018, z * 0.018, 3, 11.3);
}

export function pathX(z) {
  return 16 * Math.sin(z * 0.012) + 6 * Math.sin(z * 0.031 + 1.3);
}

export function heightAt(x, z) {
  const d = Math.abs(x - pathX(z));
  const valley = smoothstep(7, 75, d);
  const peaks = 6 + ridged(x * 0.009, z * 0.009) * 52 + fbm(x * 0.04, z * 0.04, 3, 3.1) * 6;
  const floor = fbm(x * 0.06, z * 0.06, 3, 1.7) * 0.9 - 0.5;
  return floor + valley * Math.max(0, peaks) + valley * valley * d * 0.12;
}

export function beaconLayout(count) {
  return Array.from({ length: count }, (_, i) => {
    const z = FIRST_Z - i * SPACING;
    const side = i % 2 === 0 ? 1 : -1;
    const x = pathX(z) + side * BEACON_OFFSET;
    // Sit on the lowest nearby point so the plinth never floats.
    let y = Infinity;
    for (const [dx, dz] of [[0, 0], [2, 1], [-2, 1], [2, -1], [-2, -1]]) y = Math.min(y, heightAt(x + dx, z + dz));
    const faceZ = z + 24;
    return {
      position: new Vector3(x, y, z),
      facing: new Vector3(pathX(faceZ), y, faceZ),
      side,
    };
  });
}

export function pathEndZ(count) {
  return FIRST_Z - (count - 1) * SPACING - 120;
}

export function buildCameraCurve(count) {
  const endZ = pathEndZ(count);
  const points = [];
  for (let z = 30; z >= endZ; z -= 15) {
    points.push(new Vector3(pathX(z), heightAt(pathX(z), z) + CAMERA_HEIGHT, z));
  }
  // Outro: lift off the valley floor into an aerial view toward the sun.
  points.push(new Vector3(pathX(endZ - 35), 12, endZ - 35));
  points.push(new Vector3(pathX(endZ - 70), 26, endZ - 65));
  points.push(new Vector3(pathX(endZ - 100), 40, endZ - 90));
  return new CatmullRomCurve3(points, false, 'centripetal');
}
