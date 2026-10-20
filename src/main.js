import Lenis from 'lenis';
import gsap from 'gsap';
import { World } from './scene/world.js';
import { Ambience } from './audio.js';
import { projects, profile } from './data/projects.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const quality =
  !finePointer || window.innerWidth < 800 || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high';

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const canvas = $('.webgl');
const els = {
  intro: $('[data-intro]'),
  hud: $('[data-hud]'),
  card: $('[data-card]'),
  rail: $('[data-rail]'),
  railFill: $('[data-rail-fill]'),
  hint: $('[data-scroll-hint]'),
  outro: $('[data-outro]'),
  index: $('[data-index]'),
  indexList: $('[data-index-list]'),
  detail: $('[data-detail]'),
  detailPanel: $('[data-detail-panel]'),
  cursor: $('[data-cursor]'),
};

const lenis = new Lenis({
  autoRaf: false,
  lerp: reducedMotion ? 1 : 0.075,
  wheelMultiplier: 0.8,
  touchMultiplier: 1.6,
});
lenis.stop();

let world;
let entered = false;
let shownCard = -2;
let detailIndex = -1;
let indexOpen = false;
let returnFocus = null;
let outroShown = false;
const audio = new Ambience();

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: preference just isn't remembered */
    }
  },
};

// Mono labels scramble through glyphs before settling on their text.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+*';
function decode(el, duration = 0.6) {
  if (!el || reducedMotion) return;
  const text = el.dataset.text ?? el.textContent;
  el.dataset.text = text;
  const token = (el._decode = (el._decode || 0) + 1);
  const start = performance.now();
  const step = (now) => {
    if (el._decode !== token) return;
    const t = Math.min(1, (now - start) / (duration * 1000));
    const settled = Math.floor(t * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      out += i < settled || /\s/.test(c) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c) => `<span class="char" aria-hidden="true">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  return $$('.char', el);
}

async function loadFonts() {
  const fonts = ['800 100px Unbounded', '700 100px Unbounded', '500 30px "JetBrains Mono"', '400 30px "JetBrains Mono"'];
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
  await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => {}), timeout]);
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/* ---------------------------------------------------------------- Scrolling */

function scrollToProgress(p, onComplete) {
  const target = p * lenis.limit;
  const distance = Math.abs(target - lenis.scroll) / window.innerHeight;
  lenis.scrollTo(target, {
    duration: reducedMotion ? 0 : clamp(1.2 + distance * 0.22, 1.2, 4.5),
    easing: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
    force: true,
    onComplete,
  });
}

const goToProject = (i, onComplete) => scrollToProgress(world.projectStops[i], onComplete);

/* --------------------------------------------------------------------- HUD */

function buildRail() {
  return projects.map((project, i) => {
    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'rail__tick';
    tick.style.top = `${world.projectStops[i] * 100}%`;
    tick.style.setProperty('--c', project.color);
    tick.setAttribute('aria-label', `Go to ${project.title}`);
    tick.innerHTML = `<span>${pad(i + 1)} ${esc(project.title)}</span>`;
    tick.addEventListener('click', () => goToProject(i));
    els.rail.append(tick);
    return tick;
  });
}

function cardMarkup(i) {
  const p = projects[i];
  return `
    <div class="card__meta" data-fade>
      <span class="card__num" data-decode>${pad(i + 1)}</span><span data-decode>/ ${pad(projects.length)}</span>
      <span class="card__swatch" style="--c:${p.color}"></span><span data-decode>${esc(p.year)}</span>
    </div>
    <h2 class="card__title"><span class="mask"><span>${esc(p.title)}</span></span></h2>
    <p class="card__tagline" data-fade>${esc(p.tagline)}</p>
    <button class="pill card__open" type="button" data-open-project="${i}" data-fade>Open project ${arrow}</button>`;
}

let cardTimeline;
function showCard(i) {
  cardTimeline?.kill();
  const old = [...els.card.children];
  cardTimeline = gsap.timeline();
  if (old.length) cardTimeline.to(old, { opacity: 0, y: -10, duration: 0.3, stagger: 0.03, ease: 'power2.in' });
  cardTimeline.add(() => {
    els.card.innerHTML = i < 0 ? '' : cardMarkup(i);
    if (i < 0) return;
    // Sit opposite the monument so the card never covers it.
    els.card.classList.toggle('is-right', world.beacons.items[i].side < 0);
    gsap.from($$('.mask > *', els.card), { yPercent: 110, duration: 1.1, ease: 'expo.out' });
    gsap.from($$('[data-fade]', els.card), { opacity: 0, y: 14, duration: 0.9, stagger: 0.07, delay: 0.1, ease: 'power3.out' });
    $$('[data-decode]', els.card).forEach((el) => decode(el, 0.7));
    audio.chime(i);
  });
}

let ticks = [];
function updateHud(p) {
  els.railFill.style.transform = `scaleY(${p})`;
  ticks.forEach((tick, i) => {
    tick.classList.toggle('is-passed', p >= world.projectStops[i] - 0.002);
    tick.classList.toggle('is-active', i === world.activeIndex);
  });

  const outro = clamp((p - 0.955) / 0.03, 0, 1);
  els.outro.style.opacity = outro;
  els.outro.style.visibility = outro > 0.01 ? 'visible' : 'hidden';
  if (outro > 0.01 !== outroShown) {
    outroShown = outro > 0.01;
    if (outroShown) decode($('[data-outro-kicker]'), 0.9);
  }

  const card = outro > 0 ? -1 : world.activeIndex;
  if (entered && card !== shownCard) {
    shownCard = card;
    showCard(card);
  }
  els.hint.style.opacity = entered && p < 0.008 ? 1 : 0;
}

/* ------------------------------------------------------------------ Detail */

function detailMarkup(i) {
  const p = projects[i];
  const next = (i + 1) % projects.length;
  return `
    <div class="detail__top" data-reveal>
      <span class="detail__num" data-decode>Project ${pad(i + 1)} / ${pad(projects.length)}</span>
      <button class="pill" type="button" data-close-detail data-decode-hover>Close</button>
    </div>
    <h2 class="detail__title" id="detail-title" data-reveal>${esc(p.title)}</h2>
    <p class="detail__tagline" data-reveal>${esc(p.tagline)}</p>
    <div class="detail__media" data-reveal><span>Image / video placeholder</span></div>
    <dl class="detail__facts" data-reveal>
      <div><dt>Year</dt><dd>${esc(p.year)}</dd></div>
      <div><dt>Role</dt><dd>${esc(p.role)}</dd></div>
    </dl>
    <div class="detail__body" data-reveal>${p.description.map((d) => `<p>${esc(d)}</p>`).join('')}</div>
    <ul class="detail__tags" data-reveal>${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <div class="detail__links" data-reveal>
      <a class="pill" href="${esc(p.links.live)}" target="_blank" rel="noopener">Live site ${arrow}</a>
      <a class="pill" href="${esc(p.links.code)}" target="_blank" rel="noopener">Source ${arrow}</a>
    </div>
    <button class="detail__next" type="button" data-next-project="${next}" data-reveal>
      <span>Next project</span><strong>${esc(projects[next].title)}</strong>
    </button>`;
}

function openDetail(i) {
  if (detailIndex >= 0) return;
  detailIndex = i;
  returnFocus = document.activeElement;
  els.detailPanel.innerHTML = detailMarkup(i);
  els.detailPanel.style.setProperty('--c', projects[i].color);
  els.detailPanel.scrollTop = 0;
  els.detail.hidden = false;
  document.body.classList.add('detail-open');
  lenis.stop();
  world.focusIndex = i;
  gsap
    .timeline()
    .fromTo($('.detail__backdrop', els.detail), { opacity: 0 }, { opacity: 1, duration: 0.6 })
    .fromTo(
      els.detailPanel,
      { clipPath: 'inset(0% 0% 0% 100%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: reducedMotion ? 0.01 : 1, ease: 'expo.inOut' },
      0,
    )
    .from($$('[data-reveal]', els.detailPanel), { y: 28, opacity: 0, duration: 0.9, stagger: 0.05, ease: 'power3.out' }, 0.45)
    .add(() => decode($('[data-decode]', els.detailPanel), 0.8), 0.45);
  $('[data-close-detail]', els.detailPanel).focus({ preventScroll: true });
  audio.whoosh(true);
}

function closeDetail(then) {
  if (detailIndex < 0) return;
  world.focusIndex = -1;
  document.body.classList.remove('detail-open');
  audio.whoosh(false);
  gsap
    .timeline({
      onComplete: () => {
        els.detail.hidden = true;
        detailIndex = -1;
        lenis.start();
        if (then) then();
        else returnFocus?.focus?.({ preventScroll: true });
      },
    })
    .to(els.detailPanel, { clipPath: 'inset(0% 0% 0% 100%)', duration: reducedMotion ? 0.01 : 0.8, ease: 'expo.inOut' })
    .to($('.detail__backdrop', els.detail), { opacity: 0, duration: 0.5 }, 0.2);
}

// Open a project: travel to it first if the camera is somewhere else.
function openProject(i) {
  if (world.activeIndex === i) openDetail(i);
  else goToProject(i, () => openDetail(i));
}

/* ------------------------------------------------------------------- Index */

const rightArrow = '<svg class="index__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function buildIndex() {
  $('[data-index-count]').textContent = `(${pad(projects.length)})`;
  els.indexList.innerHTML = projects
    .map(
      (p, i) => `
      <li class="index__row" style="--c:${p.color}">
        <button type="button" data-go="${i}" data-preview="${i}" aria-label="${esc(p.title)}: ${esc(p.tagline)}">
          <span class="index__num">${pad(i + 1)}</span>
          <span class="index__title">${esc(p.title)}</span>
          <span class="index__tags">${p.tags.slice(0, 2).map(esc).join(' · ')}</span>
          <span class="index__year">${esc(p.year)}</span>
          ${rightArrow}
        </button>
      </li>`,
    )
    .join('');

  const preview = (e) => {
    const row = e.target.closest('[data-preview]');
    if (row) showPreview(+row.dataset.preview);
  };
  els.indexList.addEventListener('pointerover', preview);
  els.indexList.addEventListener('focusin', preview);
}

let previewIndex = -1;
function showPreview(i) {
  if (i === previewIndex) return;
  previewIndex = i;
  $$('.index__row', els.indexList).forEach((row, r) => row.classList.toggle('is-preview', r === i));
  const panel = $('[data-index-preview]');
  const p = projects[i];
  panel.style.setProperty('--c', p.color);
  panel.innerHTML = `
    <div class="index__art"><span class="index__art-label">Image placeholder</span><span class="index__art-num">${pad(i + 1)}</span></div>
    <p class="index__p-title">${esc(p.title)}</p>
    <p class="index__p-tagline">${esc(p.tagline)}</p>
    <p class="index__p-meta">${[p.year, ...p.tags].map(esc).join(' · ')}</p>`;
  gsap.fromTo(
    panel.children,
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out', overwrite: true },
  );
}

// Mark the project the camera is standing at.
function markCurrent() {
  const current = world?.activeIndex ?? -1;
  $$('.index__row', els.indexList).forEach((row, r) => {
    $('.index__here', row)?.remove();
    if (r === current) $('.index__title', row).insertAdjacentHTML('beforeend', '<span class="index__here">Here</span>');
  });
}

function openIndex() {
  if (indexOpen || detailIndex >= 0) return;
  indexOpen = true;
  returnFocus = document.activeElement;
  els.index.hidden = false;
  document.body.classList.add('index-open');
  lenis.stop();
  markCurrent();
  previewIndex = -1;
  showPreview(Math.max(0, world.activeIndex));
  gsap.fromTo(els.index, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  gsap.from($$('.index__row', els.index), { y: 24, opacity: 0, duration: 0.8, stagger: 0.04, ease: 'expo.out', delay: 0.1 });
  gsap.from('.index__preview', { opacity: 0, x: -20, duration: 0.9, ease: 'expo.out', delay: 0.15 });
  $$('.index__num, .index__year, .index__label, .index__count', els.index).forEach((el) => decode(el, 0.7));
  $('[data-close-index]').focus({ preventScroll: true });
  audio.whoosh(true);
}

function closeIndex(then) {
  if (!indexOpen) return;
  document.body.classList.remove('index-open');
  audio.whoosh(false);
  gsap.to(els.index, {
    opacity: 0,
    duration: 0.4,
    ease: 'power2.in',
    onComplete: () => {
      els.index.hidden = true;
      indexOpen = false;
      lenis.start();
      if (then) then();
      else returnFocus?.focus?.({ preventScroll: true });
    },
  });
}

/* ------------------------------------------------------------------ Cursor */

function setupCursor() {
  if (!finePointer) return () => {};
  document.body.classList.add('has-cursor');
  const follow = $('[data-cursor-follow]');
  const lead = $('[data-cursor-lead]');
  const followX = gsap.quickTo(follow, 'x', { duration: 0.45, ease: 'power3' });
  const followY = gsap.quickTo(follow, 'y', { duration: 0.45, ease: 'power3' });
  const leadX = gsap.quickTo(lead, 'x', { duration: 0.08, ease: 'power3' });
  const leadY = gsap.quickTo(lead, 'y', { duration: 0.08, ease: 'power3' });
  let overLink = false;
  window.addEventListener('pointermove', (e) => {
    followX(e.clientX);
    followY(e.clientY);
    leadX(e.clientX);
    leadY(e.clientY);
    overLink = !!e.target.closest('a, button');
  });
  let wasOpen = false;
  return () => {
    const open = world.hoverIndex >= 0 && detailIndex < 0 && !indexOpen;
    els.cursor.classList.toggle('is-open', open);
    els.cursor.classList.toggle('is-link', overLink && !open);
    if (open && !wasOpen) audio.tick();
    wasOpen = open;
  };
}

/* ------------------------------------------------------- Micro-interactions */

function setupInteractions() {
  // Buttons lean toward the cursor while it is over them, then spring back.
  let magnet = null;
  const release = (el) => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
  if (finePointer && !reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      const el = e.target.closest('.pill, .intro__enter');
      if (magnet && magnet !== el) release(magnet);
      magnet = el;
      if (!el) return;
      // Measure without the current pull so the offset doesn't feed back on itself.
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (gsap.getProperty(el, 'x') || 0);
      const cy = r.top + r.height / 2 - (gsap.getProperty(el, 'y') || 0);
      const strength = el.classList.contains('intro__enter') ? 0.3 : 0.4;
      gsap.to(el, {
        x: (e.clientX - cx) * strength,
        y: (e.clientY - cy) * strength,
        duration: 0.4,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    });
  }

  // Hover: a soft tick, and short labels decode.
  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest('a, button');
    if (!target || target.contains(e.relatedTarget)) return;
    audio.tick();
    if (target.matches('[data-decode-hover]')) decode(target, 0.45);
  });

  document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));
}

const soundButton = $('[data-sound]');
async function setSound(on) {
  soundButton.classList.toggle('is-on', on);
  soundButton.setAttribute('aria-pressed', String(on));
  $('[data-sound-label]').textContent = on ? 'Sound on' : 'Sound off';
  storage.set('devadit-sound', on ? 'on' : 'off');
  if (on) await audio.enable();
  else audio.disable();
}

/* ------------------------------------------------------------- Intro/flow */

function revealIntro() {
  const chars = splitChars($('[data-split]'));
  gsap.set(els.intro, { visibility: 'visible' });
  gsap
    .timeline()
    .to(canvas, { opacity: 1, duration: 1.8, ease: 'power2.out' })
    .from(chars, { yPercent: 115, duration: 1.4, stagger: 0.05, ease: 'expo.out' }, 0.25)
    .from($$('[data-intro-item]'), { opacity: 0, y: 16, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.7)
    .add(() => decode($('[data-intro-kicker]'), 1), 0.7)
    .add(() => {
      window.addEventListener('wheel', enter, { once: true, passive: true });
      window.addEventListener('touchmove', enter, { once: true, passive: true });
    });

  $('[data-enter]').addEventListener('click', enter);

  function enter() {
    if (entered) return;
    entered = true;
    window.removeEventListener('wheel', enter);
    window.removeEventListener('touchmove', enter);
    // Resume sound for visitors who turned it on last time.
    if (storage.get('devadit-sound') === 'on') setSound(true);
    gsap
      .timeline()
      .to(chars, { yPercent: -115, duration: 0.8, stagger: 0.03, ease: 'expo.in' })
      .to($$('[data-intro-item]'), { opacity: 0, y: -10, duration: 0.5, stagger: 0.04 }, 0)
      .to(els.intro, { autoAlpha: 0, duration: 0.6 }, 0.5)
      .to(world, { introMix: 0, duration: reducedMotion ? 0.01 : 3.4, ease: 'power3.inOut' }, 0.3)
      .add(() => {
        els.intro.remove();
        lenis.start();
      }, '-=1.2')
      .add(showHud, '-=1');
  }
}

function showHud() {
  gsap.set([els.hud, els.rail, els.hint], { visibility: 'visible' });
  gsap.from(els.hud.children, { y: -16, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out' });
  gsap.from(els.rail, { opacity: 0, duration: 1.2 });
  decode($('.brand__sub'), 0.9);
  shownCard = -2;
}

function bindEvents() {
  window.addEventListener('resize', () => world.resize());

  window.addEventListener('pointermove', (e) => world.setPointer(e.clientX, e.clientY, e.target === canvas));

  canvas.addEventListener('click', (e) => {
    if (!entered || detailIndex >= 0 || world.introMix > 0.05) return;
    const i = world.pickAt(e.clientX, e.clientY);
    if (i >= 0) openProject(i);
  });

  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-open-project], [data-go], [data-next-project], [data-close-detail], [data-open-index], [data-close-index], [data-go-contact], [data-home], [data-sound]');
    if (!target) return;
    const d = target.dataset;
    if (d.sound !== undefined) setSound(!audio.enabled);
    else if (d.openProject !== undefined) openProject(+d.openProject);
    else if (d.go !== undefined) closeIndex(() => goToProject(+d.go));
    else if (d.nextProject !== undefined) closeDetail(() => openProject(+d.nextProject));
    else if (d.closeDetail !== undefined) closeDetail();
    else if (d.openIndex !== undefined) openIndex();
    else if (d.closeIndex !== undefined) closeIndex();
    else if (d.goContact !== undefined) scrollToProgress(1);
    else if (d.home !== undefined) {
      e.preventDefault();
      scrollToProgress(0);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!entered) return;
    if (e.key === 'Escape') {
      if (detailIndex >= 0) closeDetail();
      else if (indexOpen) closeIndex();
      return;
    }
    if (detailIndex >= 0 || indexOpen) return;
    const current = world.activeIndex;
    if (e.key === 'ArrowRight' || e.key === 'j') {
      const next = world.projectStops.findIndex((s) => s > world.progress + 0.003);
      if (next >= 0) goToProject(next);
      else scrollToProgress(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'k') {
      const stops = world.projectStops;
      let prev = -1;
      for (let i = 0; i < stops.length; i++) if (stops[i] < world.progress - 0.003) prev = i;
      if (prev >= 0) goToProject(prev);
      else scrollToProgress(0);
    } else if (e.key === 'Enter' && current >= 0 && e.target === document.body) {
      openDetail(current);
    }
  });
}

function buildContact() {
  $('[data-contact-links]').innerHTML = profile.links
    .filter((link) => link.url)
    .map((link) => `<a class="pill" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)} ${arrow}</a>`)
    .join('');
}

function showFallback() {
  els.intro.remove();
  canvas.remove();
  buildIndex();
  showPreview(0);
  els.index.hidden = false;
  $('[data-close-index]').remove();
  $('.index__label').textContent = `${profile.name} — Projects`;
}

async function start() {
  await loadFonts();

  try {
    world = new World(canvas, projects, { quality, reducedMotion });
    world.compile();
  } catch (error) {
    console.error(error);
    showFallback();
    return;
  }

  ticks = buildRail();
  buildIndex();
  buildContact();
  bindEvents();
  setupInteractions();
  const updateCursor = setupCursor();

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    lenis.raf(now);
    world.progress = lenis.limit > 0 ? clamp(lenis.animatedScroll / lenis.limit, 0, 1) : 0;
    world.update(dt);
    world.render();
    updateHud(world.smoothProgress);
    updateCursor();
    audio.setSpeed(world.speed);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Let the first frames render before fading in, so nothing pops.
  await nextFrame();
  revealIntro();

  if (new URLSearchParams(location.search).has('debug')) {
    window.__app = { world, lenis, audio, goToProject, scrollToProgress, openDetail, closeDetail, openIndex, setSound };
  }
}

start();
