import Lenis from 'lenis';
import gsap from 'gsap';
import { World } from './scene/world.js';
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
  loader: $('[data-loader]'),
  count: $('[data-count]'),
  bar: $('[data-bar]'),
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

function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c) => `<span class="char" aria-hidden="true">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  return $$('.char', el);
}

function setLoad(v) {
  els.count.textContent = String(Math.round(v)).padStart(3, '0');
  els.bar.style.transform = `scaleX(${v / 100})`;
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
      <span class="card__num">${pad(i + 1)}</span><span>/ ${pad(projects.length)}</span>
      <span class="card__swatch" style="--c:${p.color}"></span><span>${esc(p.year)}</span>
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
      <span class="detail__num">Project ${pad(i + 1)} / ${pad(projects.length)}</span>
      <button class="pill" type="button" data-close-detail>Close</button>
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
    .from($$('[data-reveal]', els.detailPanel), { y: 28, opacity: 0, duration: 0.9, stagger: 0.05, ease: 'power3.out' }, 0.45);
  $('[data-close-detail]', els.detailPanel).focus({ preventScroll: true });
}

function closeDetail(then) {
  if (detailIndex < 0) return;
  world.focusIndex = -1;
  document.body.classList.remove('detail-open');
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

function buildIndex() {
  els.indexList.innerHTML = projects
    .map(
      (p, i) => `
      <li class="index__row" style="--c:${p.color}">
        <button type="button" data-go="${i}">
          <span class="index__num">${pad(i + 1)}</span>
          <span class="index__title">${esc(p.title)}</span>
          <span class="index__year">${esc(p.year)}</span>
          <span class="index__tagline">${esc(p.tagline)}</span>
        </button>
      </li>`,
    )
    .join('');
}

function openIndex() {
  if (indexOpen || detailIndex >= 0) return;
  indexOpen = true;
  returnFocus = document.activeElement;
  els.index.hidden = false;
  document.body.classList.add('index-open');
  lenis.stop();
  gsap.fromTo(els.index, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  gsap.from($$('.index__row', els.index), { y: 40, opacity: 0, duration: 0.9, stagger: 0.05, ease: 'expo.out', delay: 0.1 });
  $('[data-close-index]').focus({ preventScroll: true });
}

function closeIndex(then) {
  if (!indexOpen) return;
  document.body.classList.remove('index-open');
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
  return () => {
    const open = world.hoverIndex >= 0 && detailIndex < 0 && !indexOpen;
    els.cursor.classList.toggle('is-open', open);
    els.cursor.classList.toggle('is-link', overLink && !open);
  };
}

/* ------------------------------------------------------------- Intro/flow */

function revealIntro() {
  const chars = splitChars($('[data-split]'));
  $('[data-role]').textContent = profile.role;
  gsap.set(els.intro, { visibility: 'visible' });
  gsap.set(els.loader, { clipPath: 'inset(0% 0% 0% 0%)' });
  gsap
    .timeline()
    .to(els.loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' })
    .from(chars, { yPercent: 115, duration: 1.4, stagger: 0.05, ease: 'expo.out' }, '-=0.45')
    .from($$('[data-intro-item]'), { opacity: 0, y: 16, duration: 1, stagger: 0.08, ease: 'power3.out' }, '-=1.1')
    .add(() => {
      els.loader.remove();
      window.addEventListener('wheel', enter, { once: true, passive: true });
      window.addEventListener('touchmove', enter, { once: true, passive: true });
    });

  $('[data-enter]').addEventListener('click', enter);

  function enter() {
    if (entered) return;
    entered = true;
    window.removeEventListener('wheel', enter);
    window.removeEventListener('touchmove', enter);
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
    const target = e.target.closest('[data-open-project], [data-go], [data-next-project], [data-close-detail], [data-open-index], [data-close-index], [data-go-contact], [data-home]');
    if (!target) return;
    const d = target.dataset;
    if (d.openProject !== undefined) openProject(+d.openProject);
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
  $('[data-contact-links]').innerHTML = `
    <a class="pill" href="mailto:${esc(profile.email)}">Email ${arrow}</a>
    <a class="pill" href="${esc(profile.github)}" target="_blank" rel="noopener">GitHub ${arrow}</a>
    <a class="pill" href="${esc(profile.linkedin)}" target="_blank" rel="noopener">LinkedIn ${arrow}</a>`;
}

function showFallback() {
  els.loader.remove();
  els.intro.remove();
  canvas.remove();
  buildIndex();
  els.index.hidden = false;
  $('[data-close-index]').remove();
  $('.index__label').textContent = `${profile.name} — Projects`;
}

async function start() {
  const intro = gsap.to({ v: 0 }, { v: 30, duration: 0.8, ease: 'power2.out', onUpdate() { setLoad(this.targets()[0].v); } });
  await loadFonts();
  await nextFrame();

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
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const progress = { v: intro.targets()[0].v };
  intro.kill();
  await gsap.to(progress, { v: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: () => setLoad(progress.v) });
  revealIntro();

  if (new URLSearchParams(location.search).has('debug')) {
    window.__app = { world, lenis, goToProject, scrollToProgress, openDetail, closeDetail, openIndex };
  }
}

start();
