// Entry point. Builds one or two viewer panes depending on URL state.
// Single mode mounts a left pane only; compare mode mounts a right pane
// alongside, with optional camera sync. Global controls (HDRI, exposure,
// tone, inspect mode) apply to every active pane. URL state drives the
// initial layout and is rewritten on every control change so links are
// shareable.

import * as THREE from 'three';
import GUI from 'lil-gui';
import { createViewer, loadModel } from './viewer.js';
import { createLightingManager } from './lighting.js';
import { createInspector, INSPECT_MODES } from './inspect.js';
import { createGallery } from './gallery.js';
import { createMetadataOverlay } from './metadata.js';
import { takeScreenshot } from './screenshot.js';
import { readState, writeState } from './url-state.js';
import { createCompareManager } from './compare.js';

const TONE_MAPPING = {
  aces: THREE.ACESFilmicToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  linear: THREE.LinearToneMapping,
};

const canvasLeft = document.getElementById('stage');
const canvasRight = document.getElementById('stage2');
const statusEl = document.getElementById('status');
const hdriSelect = document.getElementById('hdri-select');
const compareToggle = document.getElementById('compare-toggle');
const inspectPanel = document.getElementById('inspect-panel');
const galleryRail = document.getElementById('gallery-rail');
const metadataContainer = document.getElementById('metadata-pills');
const screenshotBtn = document.getElementById('screenshot-btn');
const displayGuiContainer = document.getElementById('display-gui');
const compareControls = document.getElementById('compare-controls');
const syncToggle = document.getElementById('sync-toggle');
const galleryToggle = document.getElementById('gallery-toggle');
const inspectToggle = document.getElementById('inspect-toggle');
const paneLabelLeft = document.getElementById('pane-label-left');
const paneLabelRight = document.getElementById('pane-label-right');
const paneControlsRight = document.getElementById('pane-controls-right');
const model2Select = document.getElementById('model2-select');

const state = readState();

function disposeMaterial(material) {
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) value.dispose();
  }
  material.dispose();
}

function disposeRoot(scene, root) {
  root.traverse((node) => {
    if (node.isMesh) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
        else disposeMaterial(node.material);
      }
    }
  });
  scene.remove(root);
}

function buildPane({ canvas, initialState }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = TONE_MAPPING[initialState.tone] ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = initialState.exposure;
  renderer.setClearColor(0xF7F5F0, 1.0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF7F5F0);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, 3);

  const lighting = createLightingManager(renderer, scene);
  lighting.loadHDRI(initialState.hdri).then(() => { needsRender = true; });

  const controls = createViewer({ canvas, scene, camera, renderer });

  let activeMesh = null;
  let activeRoot = null;
  let activeStem = null;
  let needsRender = true;
  const inspector = createInspector(() => activeMesh);

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  controls.addEventListener('change', () => { needsRender = true; });

  function requestRender() { needsRender = true; }

  function tick() {
    const moved = controls.update();
    if (needsRender || moved) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }

  async function loadStem(stem, onLoaded) {
    if (activeRoot) {
      inspector.reset();
      disposeRoot(scene, activeRoot);
      activeRoot = null;
      activeMesh = null;
    }
    const result = await loadModel(`./models/${stem}_low.glb`, scene, camera, controls, renderer);
    activeRoot = result.object;
    activeStem = stem;
    result.object.traverse((node) => {
      if (node.isMesh && !activeMesh) activeMesh = node;
    });
    needsRender = true;
    if (onLoaded) onLoaded({ stem, result });
    return result;
  }

  function applyView(mode) {
    inspector.setMode(mode);
    needsRender = true;
  }

  function applyHDRI(key) {
    return lighting.loadHDRI(key).then(() => { needsRender = true; });
  }

  function applyExposure(value) {
    renderer.toneMappingExposure = value;
    needsRender = true;
  }

  function applyTone(value) {
    renderer.toneMapping = TONE_MAPPING[value] ?? THREE.ACESFilmicToneMapping;
    needsRender = true;
  }

  function dispose() {
    if (activeRoot) disposeRoot(scene, activeRoot);
    lighting.dispose();
    controls.dispose();
    renderer.dispose();
  }

  return {
    canvas, renderer, scene, camera, controls, lighting, inspector,
    resize, tick, requestRender,
    loadStem, applyView, applyHDRI, applyExposure, applyTone, dispose,
    getActiveStem: () => activeStem,
    getActiveMesh: () => activeMesh,
  };
}

const panes = [];
let leftPane = null;
let rightPane = null;
let compareManager = null;
let currentInspectMode = state.view;

function renderLoop() {
  for (const pane of panes) pane.tick();
  requestAnimationFrame(renderLoop);
}

function resizeAll() {
  for (const pane of panes) pane.resize();
}
window.addEventListener('resize', resizeAll);

const metadata = createMetadataOverlay(metadataContainer);

const inspectButtons = Array.from(inspectPanel.querySelectorAll('[data-mode]'));

function setActiveButton(mode) {
  for (const btn of inspectButtons) {
    btn.classList.toggle('is-active', btn.dataset.mode === mode);
    btn.setAttribute('aria-pressed', btn.dataset.mode === mode ? 'true' : 'false');
  }
}

function enableInspectButtons() {
  for (const btn of inspectButtons) btn.disabled = false;
}

for (const btn of inspectButtons) {
  btn.disabled = true;
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (!INSPECT_MODES.includes(mode)) return;
    currentInspectMode = mode;
    for (const pane of panes) pane.applyView(mode);
    setActiveButton(mode);
    writeState({ view: mode });
  });
}

hdriSelect.value = state.hdri;
hdriSelect.addEventListener('change', (e) => {
  const key = e.target.value;
  for (const pane of panes) pane.applyHDRI(key);
  writeState({ hdri: key });
});

const displaySettings = {
  exposure: state.exposure,
  tone: state.tone,
};

const gui = new GUI({ container: displayGuiContainer, title: 'Display' });
gui.add(displaySettings, 'exposure', 0.2, 3.0, 0.05)
  .name('Exposure')
  .onChange((value) => {
    for (const pane of panes) pane.applyExposure(value);
    writeState({ exposure: value });
  });
gui.add(displaySettings, 'tone', { ACES: 'aces', Reinhard: 'reinhard', Linear: 'linear' })
  .name('Tone')
  .onChange((value) => {
    for (const pane of panes) pane.applyTone(value);
    writeState({ tone: value });
  });

screenshotBtn.addEventListener('click', () => {
  if (!leftPane || !leftPane.getActiveStem()) return;
  takeScreenshot({
    renderer: leftPane.renderer,
    scene: leftPane.scene,
    camera: leftPane.camera,
    stem: leftPane.getActiveStem(),
    viewName: currentInspectMode,
  }).catch((err) => console.error('Screenshot failed', err));
});

syncToggle.addEventListener('change', (e) => {
  if (compareManager) compareManager.setSync(e.target.checked);
  writeState({ sync: e.target.checked ? 1 : 0 });
});

function toggleRail(key) {
  const cls = `${key}-collapsed`;
  const collapsed = document.body.classList.toggle(cls);
  const btn = key === 'gallery' ? galleryToggle : inspectToggle;
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  btn.setAttribute('aria-label', collapsed ? `Expand ${key}` : `Collapse ${key}`);
}

galleryToggle.addEventListener('click', () => toggleRail('gallery'));
inspectToggle.addEventListener('click', () => toggleRail('inspect'));

const manifestByStem = new Map();

const gallery = await createGallery({
  container: galleryRail,
  onSelect: (stem) => {
    gallery.setActive(stem);
    writeState({ model: stem });
    if (leftPane) handleLoad(leftPane, stem, true);
  },
});

const entries = gallery.getEntries();
for (const entry of entries) manifestByStem.set(entry.stem, entry);

for (const entry of entries) {
  const opt = document.createElement('option');
  opt.value = entry.stem;
  opt.textContent = entry.stem;
  model2Select.appendChild(opt);
}

model2Select.addEventListener('change', (e) => {
  const stem = e.target.value;
  writeState({ model2: stem });
  if (rightPane) handleLoad(rightPane, stem, false);
});

function handleLoad(pane, stem, isLeft) {
  if (isLeft) statusEl.textContent = 'Loading...';
  pane.loadStem(stem).then(({ result }) => {
    if (isLeft) {
      statusEl.textContent = `Loaded ${stem}`;
      enableInspectButtons();
      screenshotBtn.disabled = false;
      paneLabelLeft.textContent = stem;
      const entry = manifestByStem.get(stem) || {};
      metadata.update({
        vertexCount: result.vertexCount,
        triangleCount: result.triangleCount,
        fileSize: entry.glb_bytes,
        seconds: entry.seconds,
      });
    } else {
      paneLabelRight.textContent = stem;
    }
    if (currentInspectMode !== 'lit') pane.applyView(currentInspectMode);
    setActiveButton(currentInspectMode);
  }).catch((err) => {
    console.error('Load failed', err);
    if (isLeft) statusEl.textContent = 'Load failed';
  });
}

function enterCompare(model2Stem) {
  if (rightPane) return;
  document.body.classList.add('mode-compare');
  paneLabelLeft.hidden = false;
  paneControlsRight.hidden = false;
  compareControls.hidden = false;
  canvasRight.hidden = false;
  compareToggle.classList.add('is-active');
  compareToggle.setAttribute('aria-pressed', 'true');

  rightPane = buildPane({ canvas: canvasRight, initialState: {
    hdri: hdriSelect.value,
    exposure: displaySettings.exposure,
    tone: displaySettings.tone,
  } });
  panes.push(rightPane);
  rightPane.resize();
  leftPane.resize();

  compareManager = createCompareManager(leftPane, rightPane, state.sync === 1);
  syncToggle.checked = state.sync === 1;

  const stem = (model2Stem && manifestByStem.has(model2Stem))
    ? model2Stem
    : entries[Math.min(1, entries.length - 1)]?.stem;
  if (stem) {
    model2Select.value = stem;
    handleLoad(rightPane, stem, false);
  }
}

function exitCompare() {
  if (!rightPane) return;
  document.body.classList.remove('mode-compare');
  paneLabelLeft.hidden = true;
  paneControlsRight.hidden = true;
  compareControls.hidden = true;
  canvasRight.hidden = true;
  compareToggle.classList.remove('is-active');
  compareToggle.setAttribute('aria-pressed', 'false');

  if (compareManager) { compareManager.dispose(); compareManager = null; }
  const idx = panes.indexOf(rightPane);
  if (idx >= 0) panes.splice(idx, 1);
  rightPane.dispose();
  rightPane = null;
  leftPane.resize();
}

compareToggle.addEventListener('click', () => {
  if (rightPane) {
    exitCompare();
    writeState({ mode: 'single', model2: null });
  } else {
    const seed = state.model2 || entries[Math.min(1, entries.length - 1)]?.stem || null;
    enterCompare(seed);
    writeState({ mode: 'compare', model2: seed });
  }
});

leftPane = buildPane({ canvas: canvasLeft, initialState: state });
panes.push(leftPane);
renderLoop();
leftPane.resize();

const initialStem = (state.model && manifestByStem.has(state.model))
  ? state.model
  : (entries[0]?.stem ?? null);

if (initialStem) {
  gallery.setActive(initialStem);
  writeState({ model: initialStem });
  handleLoad(leftPane, initialStem, true);
} else {
  statusEl.textContent = 'No models in manifest';
}

if (state.mode === 'compare') {
  enterCompare(state.model2);
}

if (state.shot === 1) {
  setTimeout(() => {
    if (!leftPane.getActiveStem()) return;
    takeScreenshot({
      renderer: leftPane.renderer,
      scene: leftPane.scene,
      camera: leftPane.camera,
      stem: leftPane.getActiveStem(),
      viewName: currentInspectMode,
    }).then(() => { window.__arcaShotDone = true; })
      .catch((err) => { console.error('Headless screenshot failed', err); window.__arcaShotDone = true; });
  }, 1200);
}
