import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { mistTime, withMist } from './mist.js';

const OUTER_W = 6.4;
const OUTER_H = 9.4;
const FRAME = 0.45;
const BASE = 0.5;
const INNER_W = OUTER_W - FRAME * 2;
const INNER_H = OUTER_H - FRAME * 2;

function archShape(w, h, y = 0) {
  const r = w / 2;
  const s = new Shape();
  s.moveTo(-r, y);
  s.lineTo(r, y);
  s.lineTo(r, y + h - r);
  s.absarc(0, y + h - r, r, 0, Math.PI, false);
  s.lineTo(-r, y);
  return s;
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function panelTexture(project, index, total, maxAnisotropy) {
  const W = 1024;
  const H = Math.round((W * INNER_H) / INNER_W);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pad = 84;
  const num = String(index + 1).padStart(2, '0');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

  ctx.textAlign = 'center';
  ctx.font = '800 300px Unbounded';
  ctx.lineWidth = 3;
  ctx.strokeText(num, W / 2, H * 0.37);

  ctx.font = '500 28px "JetBrains Mono"';
  ctx.letterSpacing = '6px';
  ctx.fillText(`PROJECT ${num} / ${String(total).padStart(2, '0')}`, W / 2, H * 0.37 + 80);

  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';
  ctx.fillRect(pad, H * 0.66, W - pad * 2, 2);

  ctx.font = '700 80px Unbounded';
  let y = H * 0.66 + 120;
  for (const line of wrapLines(ctx, project.title.toUpperCase(), W - pad * 2)) {
    ctx.fillText(line, pad, y);
    y += 92;
  }

  ctx.globalAlpha = 0.78;
  ctx.font = '400 30px "JetBrains Mono"';
  y += 6;
  for (const line of wrapLines(ctx, project.tagline, W - pad * 2)) {
    ctx.fillText(line, pad, y);
    y += 44;
  }

  ctx.globalAlpha = 0.6;
  ctx.letterSpacing = '4px';
  // One line only, so long tag lists shrink until they fit.
  const meta = [project.year, ...project.tags].join('  ·  ').toUpperCase();
  let size = 24;
  do ctx.font = `500 ${size}px "JetBrains Mono"`;
  while (ctx.measureText(meta).width > W - pad * 2 && --size > 14);
  ctx.fillText(meta, pad, H - 70);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

const panelVertex = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec3 transformed = position;
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const panelFragment = /* glsl */ `
  uniform sampler2D uText;
  uniform vec3 uColor;
  uniform float uTime, uActive, uHover, uSeed, uReveal;
  varying vec2 vUv;
  #include <fog_pars_fragment>

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.02 + 17.0; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.07;

    // Placeholder artwork: a slow domain-warped field in the project colour.
    vec2 p = uv * vec2(1.6, 2.4);
    vec2 q = vec2(fbm(p + uSeed + t), fbm(p + uSeed * 1.7 - t + 4.2));
    float n = fbm(p * 1.3 + q * 2.2 + uSeed + uHover * 0.25 * sin(uTime));
    vec3 col = mix(vec3(0.012, 0.01, 0.025), uColor * 0.75, smoothstep(0.38, 0.82, n));
    col += uColor * pow(smoothstep(0.6, 0.95, n), 3.0) * 1.2;

    col *= mix(0.18, 1.0, smoothstep(0.08, 0.6, uv.y));
    col *= 0.9 + 0.1 * sin(uv.y * 900.0 - uTime * 3.0);
    col *= mix(0.22, 1.0, uActive) * (1.0 + uHover * 0.4);

    // Hover ripples the text slightly; the reveal wipes it in from below.
    vec2 tuv = uv + vec2(sin(uv.y * 60.0 + uTime * 9.0) * 0.0025 * uHover, 0.0);
    float txt = texture2D(uText, tuv).a * (1.0 - smoothstep(uReveal - 0.08, uReveal, 1.0 - uv.y));
    col = mix(col, vec3(1.0, 0.96, 0.92) * mix(0.45, 0.92, uActive), txt);

    // A single diagonal glint sweeps across the glass on first arrival.
    float sweep = uReveal * 1.7 - 0.35;
    float sheen = exp(-pow((uv.x * 0.45 + uv.y * 0.75 - sweep) * 12.0, 2.0));
    col += vec3(1.0, 0.95, 0.88) * sheen * 0.4 * uActive;

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

const beamVertex = /* glsl */ `
  varying float vY, vEdge, vFade;
  void main() {
    vY = uv.y;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 v = normalize(cameraPosition - wp.xyz);
    vEdge = pow(abs(dot(n, v)), 3.0);
    vec4 mv = viewMatrix * wp;
    vFade = exp(-pow(-mv.z * 0.0035, 2.0));
    gl_Position = projectionMatrix * mv;
  }`;

const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity, uTime;
  varying float vY, vEdge, vFade;
  void main() {
    float bands = 0.7 + 0.3 * sin(vY * 160.0 - uTime * 4.0);
    float a = vEdge * pow(1.0 - vY, 2.2) * uIntensity * vFade * bands;
    gl_FragColor = vec4(uColor * a * 2.0, a);
  }`;

export function createBeacons(projects, layout, maxAnisotropy) {
  const group = new Group();
  const stone = withMist(new MeshStandardMaterial({ color: '#1c1727', roughness: 0.55, metalness: 0.35 }));

  const frameShape = archShape(OUTER_W, OUTER_H, BASE);
  frameShape.holes.push(archShape(INNER_W, INNER_H, BASE + FRAME));
  const frameGeo = new ExtrudeGeometry(frameShape, {
    depth: 0.7,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
    curveSegments: 32,
  });
  frameGeo.translate(0, 0, -0.35);

  // The bevel pulls the opening in by its size, so inset the rim past it.
  const inset = (d) => archShape(INNER_W - d * 2, INNER_H - d * 2, BASE + FRAME + d);
  const rimShape = inset(0.08);
  rimShape.holes.push(inset(0.2));
  const rimGeo = new ShapeGeometry(rimShape, 32);

  const panelGeo = new ShapeGeometry(archShape(INNER_W, INNER_H, BASE + FRAME), 32);
  const uv = panelGeo.attributes.uv;
  const pos = panelGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) + INNER_W / 2) / INNER_W, (pos.getY(i) - BASE - FRAME) / INNER_H);
  }

  const plinthGeo = new BoxGeometry(OUTER_W + 1.6, BASE, 2.4);
  plinthGeo.translate(0, BASE / 2, 0);
  const beamGeo = new CylinderGeometry(0.55, 0.55, 160, 20, 1, true);
  beamGeo.translate(0, 80 + BASE + OUTER_H, 0);
  const ringGeo = new RingGeometry(4.6, 4.85, 96);
  ringGeo.rotateX(-Math.PI / 2);

  const items = projects.map((project, index) => {
    const color = new Color(project.color);
    const { position, facing } = layout[index];
    const beacon = new Group();
    beacon.position.copy(position);
    beacon.lookAt(facing);

    beacon.add(new Mesh(frameGeo, stone));
    beacon.add(new Mesh(plinthGeo, stone));

    const rimMaterial = new MeshBasicMaterial({ color: color.clone(), side: DoubleSide });
    const rim = new Mesh(rimGeo, rimMaterial);
    rim.position.z = 0.1;
    beacon.add(rim);

    const panelMaterial = new ShaderMaterial({
      fog: true,
      side: DoubleSide,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uText: { value: null },
          uColor: { value: color },
          uTime: { value: 0 },
          uActive: { value: 0 },
          uHover: { value: 0 },
          uReveal: { value: 0 },
          uSeed: { value: index * 3.17 },
        },
      ]),
      vertexShader: panelVertex,
      fragmentShader: panelFragment,
    });
    panelMaterial.uniforms.uText.value = panelTexture(project, index, projects.length, maxAnisotropy);
    // Shared by reference (merge() would have cloned it) so the mist drifts.
    panelMaterial.uniforms.uMistTime = mistTime;
    const panel = new Mesh(panelGeo, panelMaterial);
    panel.userData.index = index;
    panel.position.z = -0.05;
    beacon.add(panel);

    const beamMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uColor: { value: color }, uIntensity: { value: 0.3 }, uTime: { value: 0 } },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
    });
    const beam = new Mesh(beamGeo, beamMaterial);
    beam.frustumCulled = false;
    beacon.add(beam);

    const ringMaterial = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const ring = new Mesh(ringGeo, ringMaterial);
    ring.position.y = 0.3;
    beacon.add(ring);
    const pulseMaterial = ringMaterial.clone();
    const pulse = new Mesh(ringGeo, pulseMaterial);
    pulse.position.y = 0.3;
    beacon.add(pulse);

    group.add(beacon);
    beacon.updateMatrixWorld(true);

    return {
      index,
      panel,
      color,
      focus: beacon.localToWorld(new Vector3(0, BASE + FRAME + INNER_H * 0.5, 0)),
      // Where the camera should stand to frame the panel when it is opened.
      viewpoint: beacon.localToWorld(new Vector3(0, BASE + FRAME + INNER_H * 0.5, 19)),
      focusLook: beacon.localToWorld(new Vector3(5.2, BASE + FRAME + INNER_H * 0.5, 0)),
      side: layout[index].side,
      active: 0,
      hover: 0,
      reveal: 0,
      update(time, dt, targetActive, hovered) {
        this.active = MathUtils.damp(this.active, targetActive, 4, dt);
        this.hover = MathUtils.damp(this.hover, hovered ? 1 : 0, 8, dt);
        if (targetActive > 0.5) this.reveal = Math.min(1.08, this.reveal + dt * 0.9);
        const u = panelMaterial.uniforms;
        u.uTime.value = time;
        u.uActive.value = this.active;
        u.uHover.value = this.hover;
        u.uReveal.value = this.reveal;
        rimMaterial.color.copy(color).multiplyScalar(0.35 + this.active * 2.2 + this.hover * 1.2);
        beamMaterial.uniforms.uTime.value = time;
        beamMaterial.uniforms.uIntensity.value = 0.25 + this.active * 0.9;
        ringMaterial.opacity = 0.1 + this.active * 0.35;
        const cycle = (time * 0.45 + index * 0.13) % 1;
        pulse.scale.setScalar(1 + cycle * 0.9);
        pulseMaterial.opacity = (1 - cycle) * (0.05 + this.active * 0.3);
      },
    };
  });

  return { group, items, pickables: items.map((item) => item.panel) };
}
