import {
  ACESFilmicToneMapping,
  DirectionalLight,
  FogExp2,
  HalfFloatType,
  HemisphereLight,
  MathUtils,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { beaconLayout, buildCameraCurve, pathX } from './layout.js';
import {
  createFireflies,
  createRiver,
  createSky,
  createTerrain,
  createVegetation,
  installSunFog,
  palette,
  sunDirection,
} from './environment.js';
import { createBeacons } from './beacons.js';
import { mistTime } from './mist.js';

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new Vector2() },
    uSpeed: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uSpeed;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      // Lens fringing, which opens up along with a radial blur when moving fast.
      vec2 shift = c * r2 * (0.012 + uSpeed * 0.05);
      vec3 col = vec3(texture2D(tDiffuse, vUv + shift).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - shift).b);
      // The extra taps only run while moving fast.
      if (uSpeed > 0.002) {
        float blur = uSpeed * 0.012;
        for (int i = 1; i < 4; i++) {
          vec2 uv = vUv - c * blur * float(i);
          col += vec3(texture2D(tDiffuse, uv + shift).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - shift).b);
        }
        col *= 0.25;
      }
      col *= 1.0 - smoothstep(0.12, 0.62, r2) * 0.55;
      col += (hash(vUv * uResolution + fract(uTime * 7.0) * 91.0) - 0.5) * 0.05;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// Bloom spreads a single NaN pixel across the whole frame, so scrub them first.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: FinishShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      bool bad = any(isnan(c)) || any(isinf(c)) || !(c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0);
      gl_FragColor = vec4(bad ? vec3(0.0) : min(c, vec3(32.0)), 1.0);
    }`,
};

// Renders the scene into its own multisampled target, then scrubs it into the
// composer's plain buffer. Only this step pays for anti-aliasing; the bloom
// and grading passes after it work on ordinary single-sample buffers.
class ScenePass extends Pass {
  constructor(scene, camera, samples) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples });
    this.material = new ShaderMaterial({
      uniforms: { tDiffuse: { value: this.target.texture } },
      vertexShader: SanitizeShader.vertexShader,
      fragmentShader: SanitizeShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(width, height) {
    this.target.setSize(width, height);
  }

  setSamples(samples) {
    if (this.target.samples === samples) return;
    this.target.samples = samples;
    this.target.dispose();
  }

  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

const DWELL_WIDTH = 0.018;
const DWELL_STRENGTH = 3.2;

export class World {
  constructor(canvas, projects, { quality, reducedMotion }) {
    this.projects = projects;
    this.quality = quality;
    this.reducedMotion = reducedMotion;

    installSunFog();

    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new Scene();
    this.scene.fog = new FogExp2(palette.fog, 0.0058);
    this.camera = new PerspectiveCamera(52, 1, 0.1, 2600);

    const sun = new DirectionalLight('#ff9e6e', 2.6);
    sun.position.copy(sunDirection).multiplyScalar(200);
    const fill = new DirectionalLight('#7b84ff', 0.9);
    fill.position.set(40, 80, 120);
    this.scene.add(sun, fill, new HemisphereLight('#8a6fd0', '#1a1226', 0.7));

    this.sky = createSky();
    this.terrain = createTerrain(projects.length, quality);
    this.river = createRiver(projects.length);
    this.fireflies = createFireflies(projects.length, quality);
    const layout = beaconLayout(projects.length);
    this.beacons = createBeacons(projects, layout, this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.sky, this.terrain, this.river, this.fireflies, this.beacons.group);
    this.vegetation = createVegetation(projects.length, layout, quality);
    this.scene.add(...this.vegetation.objects);

    this.curve = buildCameraCurve(projects.length);
    this.#buildScrollMap(layout);

    const size = new Vector2(window.innerWidth, window.innerHeight);
    const target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.scenePass = new ScenePass(this.scene, this.camera, quality === 'low' ? 0 : 4);
    this.composer.addPass(this.scenePass);
    this.bloom = new UnrealBloomPass(size, 0.55, 0.5, 0.95);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finish = new ShaderPass(FinishShader);
    this.composer.addPass(this.finish);

    // Camera state.
    this.progress = 0;
    this.smoothProgress = 0;
    this.introMix = 1;
    this.focusIndex = -1;
    this.focusMix = 0;
    this.pointer = new Vector2(0, 0);
    this.parallax = new Vector2(0, 0);
    this.pointerInside = false;
    this.hoverIndex = -1;
    this.activeIndex = -1;
    this.roll = 0;
    this.lastYaw = null;
    this.time = 0;
    this.speed = 0;
    this.lastProgress = 0;
    this.hoverZoom = 0;
    this.resolutionScale = 1;
    this.frameStats = { time: 0, frames: 0, slow: 0, fast: 0 };

    this.raycaster = new Raycaster();
    this.tmp = {
      pos: new Vector3(),
      look: new Vector3(),
      ahead: new Vector3(),
      tangent: new Vector3(),
      right: new Vector3(),
      introPos: new Vector3(pathX(60), 58, 150),
      introLook: new Vector3(pathX(-260), 6, -260),
      forward: new Vector3(),
    };

    this.resize();
  }

  // Map scroll progress to a position on the curve, spending more scroll
  // around each project so the camera lingers where there is something to see.
  #buildScrollMap(layout) {
    const samples = 2400;
    const points = this.curve.getSpacedPoints(samples);
    this.dwell = layout.map((beacon) => {
      const targetZ = beacon.position.z + 22;
      let best = 0;
      for (let i = 1; i <= samples; i++) {
        if (Math.abs(points[i].z - targetZ) < Math.abs(points[best].z - targetZ)) best = i;
      }
      return best / samples;
    });

    const cumulative = new Float32Array(samples + 1);
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      let w = 1;
      for (const u of this.dwell) w += DWELL_STRENGTH * Math.exp(-(((t - u) / DWELL_WIDTH) ** 2));
      cumulative[i] = cumulative[i - 1] + w;
    }
    const total = cumulative[samples];
    for (let i = 0; i <= samples; i++) cumulative[i] /= total;
    this.scrollMap = cumulative;
    this.projectStops = this.dwell.map((u) => cumulative[Math.round(u * samples)]);
  }

  curveParamFor(progress) {
    const map = this.scrollMap;
    const n = map.length - 1;
    let lo = 0, hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (map[mid] < progress) lo = mid;
      else hi = mid;
    }
    const span = map[hi] - map[lo] || 1;
    return (lo + (progress - map[lo]) / span) / n;
  }

  // Render resolution: the screen's pixel ratio, capped by a total pixel
  // budget so large displays aren't drawn at more detail than the GPU can keep
  // up with, then scaled by whatever adapt() has settled on.
  #pixelRatio() {
    const area = window.innerWidth * window.innerHeight;
    const cap = this.quality === 'low' ? 1.25 : 1.75;
    const budget = this.quality === 'low' ? 1.6e6 : 3.6e6;
    const fit = Math.max(1, Math.sqrt(budget / area));
    return Math.max(0.7, Math.min(window.devicePixelRatio, cap, fit) * this.resolutionScale);
  }

  // Called once per frame with the real frame time. If the frame rate stays
  // low, drop the resolution a step; once it has been smooth for a while,
  // step back up.
  adapt(seconds) {
    if (seconds > 0.25) return; // tab switch or stall, not a real frame
    const s = this.frameStats;
    s.time += seconds;
    s.frames++;
    if (s.time < 1) return;
    const fps = s.frames / s.time;
    s.time = 0;
    s.frames = 0;
    if (fps < 50) {
      s.fast = 0;
      if (++s.slow >= 2 && this.resolutionScale > 0.6) {
        s.slow = 0;
        this.resolutionScale *= 0.85;
        this.resize();
      }
    } else {
      s.slow = 0;
      if (fps > 57 && this.resolutionScale < 1 && ++s.fast >= 4) {
        s.fast = 0;
        this.resolutionScale = Math.min(1, this.resolutionScale / 0.85);
        this.resize();
      }
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = this.#pixelRatio();
    // Dense screens already smooth edges through resolution, so they need
    // less multisampling.
    if (this.quality !== 'low') this.scenePass.setSamples(ratio >= 1.4 ? 2 : 4);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    // On wide screens the detail panel covers the right side, so the focused
    // monument is framed left of centre.
    this.wideScreen = w > 900;
    this.camera.aspect = w / h;
    this.baseFov = w / h < 0.8 ? 68 : 52;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.finish.uniforms.uResolution.value.set(w * ratio, h * ratio);
    this.fireflies.material.uniforms.uPixelRatio.value = ratio * h * 0.003;
  }

  setPointer(x, y, inside) {
    this.pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.pointerInside = inside;
  }

  // Immediate pick for taps, where no hover frame has run yet.
  pickAt(x, y) {
    this.setPointer(x, y, true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.beacons.pickables, false)[0];
    return hit && hit.distance < 90 ? hit.object.userData.index : -1;
  }

  update(dt) {
    this.time += dt;
    const { pos, look, ahead, tangent, right, introPos, introLook, forward } = this.tmp;

    this.smoothProgress = MathUtils.damp(this.smoothProgress, this.progress, this.reducedMotion ? 20 : 5, dt);
    const t = this.curveParamFor(this.smoothProgress);

    this.curve.getPointAt(t, pos);
    if (t < 0.985) {
      this.curve.getPointAt(Math.min(t + 0.012, 1), ahead);
    } else {
      this.curve.getTangentAt(t, tangent);
      ahead.copy(pos).addScaledVector(tangent, 12);
    }
    look.copy(ahead);

    // Turn toward the nearest project as the camera approaches it, then let go
    // quickly once past so the camera never stares at it from point-blank range.
    let nearest = -1;
    let nearestDist = Infinity;
    this.dwell.forEach((u, i) => {
      const d = Math.abs(t - u);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    const past = t > this.dwell[nearest];
    const lean = Math.exp(-((nearestDist / (past ? 0.014 : 0.032)) ** 2));
    look.lerp(this.beacons.items[nearest].focus, lean * 0.6);
    this.activeIndex = nearestDist < (past ? 0.016 : 0.034) ? nearest : -1;

    // Opening a project glides the camera up to its panel.
    const focusTarget = this.focusIndex >= 0 ? 1 : 0;
    this.focusMix = MathUtils.damp(this.focusMix, focusTarget, 3.2, dt);
    if (this.focusIndex >= 0) this.lastFocus = this.focusIndex;
    if (this.focusMix > 0.001 && this.lastFocus != null) {
      const item = this.beacons.items[this.lastFocus];
      const e = this.focusMix * this.focusMix * (3 - 2 * this.focusMix);
      pos.lerp(item.viewpoint, e);
      look.lerp(this.wideScreen ? item.focusLook : item.focus, e);
    }

    // Aerial establishing shot during the intro.
    if (this.introMix > 0) {
      const drift = Math.sin(this.time * 0.15) * 6;
      const e = this.introMix;
      pos.lerp(this.tmp.forward.set(introPos.x + drift, introPos.y, introPos.z), e);
      look.lerp(introLook, e);
    }

    // Pointer parallax.
    const amount = this.reducedMotion ? 0 : 1;
    this.parallax.x = MathUtils.damp(this.parallax.x, this.pointer.x * amount, 2.5, dt);
    this.parallax.y = MathUtils.damp(this.parallax.y, this.pointer.y * amount, 2.5, dt);
    forward.subVectors(look, pos).normalize();
    right.crossVectors(forward, this.camera.up).normalize();
    pos.addScaledVector(right, this.parallax.x * 0.5).add(this.tmp.tangent.set(0, this.parallax.y * 0.3, 0));
    look.addScaledVector(right, this.parallax.x * 1.6).add(this.tmp.tangent.set(0, this.parallax.y * 0.9, 0));

    this.camera.position.copy(pos);
    this.camera.lookAt(look);

    // Bank gently into turns.
    const yaw = Math.atan2(forward.x, -forward.z);
    if (this.lastYaw !== null && dt > 0) {
      const rate = MathUtils.clamp((yaw - this.lastYaw) / dt, -2, 2);
      this.roll = MathUtils.damp(this.roll, this.reducedMotion ? 0 : -rate * 0.12, 3, dt);
    }
    this.lastYaw = yaw;
    this.camera.rotateZ(this.roll);

    this.sky.position.copy(this.camera.position);

    // Hover picking.
    this.hoverIndex = -1;
    if (this.pointerInside && this.introMix < 0.05) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.beacons.pickables, false)[0];
      if (hit && hit.distance < 90) this.hoverIndex = hit.object.userData.index;
    }

    // Speed: widen the lens and let the post pass smear a little when moving
    // fast; ease in slightly while a monument is hovered.
    const velocity = dt > 0 ? Math.abs(this.smoothProgress - this.lastProgress) / dt : 0;
    this.lastProgress = this.smoothProgress;
    this.speed = MathUtils.damp(this.speed, Math.min(velocity, 0.4), 5, dt);
    this.hoverZoom = MathUtils.damp(this.hoverZoom, this.hoverIndex >= 0 ? 1 : 0, 3, dt);
    const motion = this.reducedMotion ? 0 : 1;
    this.camera.fov = this.baseFov + (Math.min(9, this.speed * 45) - this.hoverZoom * 2.2) * motion;
    this.camera.updateProjectionMatrix();
    this.finish.uniforms.uSpeed.value = Math.min(1, this.speed * 4) * motion;

    for (const item of this.beacons.items) {
      const isActive = item.index === this.activeIndex || item.index === this.focusIndex;
      item.update(this.time, dt, isActive ? 1 : 0, item.index === this.hoverIndex);
    }

    this.sky.material.uniforms.uTime.value = this.time;
    this.river.material.uniforms.uTime.value = this.time;
    this.fireflies.material.uniforms.uTime.value = this.time;
    this.vegetation.update(this.time);
    mistTime.value = this.time;
    this.finish.uniforms.uTime.value = this.time;
  }

  render() {
    this.composer.render();
  }

  compile() {
    this.update(0);
    this.renderer.compile(this.scene, this.camera);
  }
}
