// Entry point. Builds the WebGL renderer, attaches HDRI lighting, the
// gallery rail, the inspect panel, the metadata overlay, the screenshot
// button, and the lil-gui Display folder. Reads SPEC 5.2 URL state on
// boot to restore the shared view, and writes back on every control
// change so the address bar is always a live snapshot. Renders lazily.

import * as THREE from 'three';
import GUI from 'lil-gui';
import { createViewer, loadModel } from './viewer.js';
import { createLightingManager } from './lighting.js';
import { createInspector, INSPECT_MODES } from './inspect.js';
import { createGallery } from './gallery.js';
import { createMetadataOverlay } from './metadata.js';
import { takeScreenshot } from './screenshot.js';
import { readState, writeState } from './url-state.js';

const TONE_MAPPING = {
  aces: THREE.ACESFilmicToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  linear: THREE.LinearToneMapping,
};

const canvas = document.getElementById('stage');
const statusEl = document.getElementById('status');
const hdriSelect = document.getElementById('hdri-select');
const inspectPanel = document.getElementById('inspect-panel');
const galleryRail = document.getElementById('gallery-rail');
const metadataContainer = document.getElementById('metadata-pills');
const screenshotBtn = document.getElementById('screenshot-btn');
const displayGuiContainer = document.getElementById('display-gui');

const state = readState();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = TONE_MAPPING[state.tone] ?? THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = state.exposure;
renderer.setClearColor(0xF7F5F0, 1.0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF7F5F0);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
camera.position.set(0, 0, 3);

let needsRender = true;

const lighting = createLightingManager(renderer, scene);
hdriSelect.value = state.hdri;
lighting.loadHDRI(state.hdri).then(() => { needsRender = true; });

const controls = createViewer({ canvas, scene, camera, renderer });

let activeMesh = null;
let activeRoot = null;
let activeStem = null;
let currentInspectMode = state.view;
const inspector = createInspector(() => activeMesh);
const metadata = createMetadataOverlay(metadataContainer);

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  needsRender = true;
}

controls.addEventListener('change', () => { needsRender = true; });
window.addEventListener('resize', resize);

function tick() {
  const moved = controls.update();
  if (needsRender || moved) {
    renderer.render(scene, camera);
    needsRender = false;
  }
  requestAnimationFrame(tick);
}

resize();
tick();

function disposeMaterial(material) {
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) value.dispose();
  }
  material.dispose();
}

function disposeRoot(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(node.material);
        }
      }
    }
  });
  scene.remove(root);
}

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
    inspector.setMode(mode);
    currentInspectMode = mode;
    setActiveButton(mode);
    writeState({ view: mode });
    needsRender = true;
  });
}

hdriSelect.addEventListener('change', (e) => {
  const key = e.target.value;
  lighting.loadHDRI(key).then(() => { needsRender = true; });
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
    renderer.toneMappingExposure = value;
    writeState({ exposure: value });
    needsRender = true;
  });
gui.add(displaySettings, 'tone', { ACES: 'aces', Reinhard: 'reinhard', Linear: 'linear' })
  .name('Tone')
  .onChange((value) => {
    renderer.toneMapping = TONE_MAPPING[value] ?? THREE.ACESFilmicToneMapping;
    writeState({ tone: value });
    needsRender = true;
  });

let manifestByStem = new Map();

async function loadStem(stem) {
  statusEl.textContent = 'Loading...';

  if (activeRoot) {
    inspector.reset();
    disposeRoot(activeRoot);
    activeRoot = null;
    activeMesh = null;
  }

  try {
    const result = await loadModel(`./models/${stem}_low.glb`, scene, camera, controls, renderer);
    activeRoot = result.object;
    activeStem = stem;
    result.object.traverse((node) => {
      if (node.isMesh && !activeMesh) activeMesh = node;
    });
    statusEl.textContent = `Loaded ${stem}`;
    enableInspectButtons();
    screenshotBtn.disabled = false;
    if (currentInspectMode !== 'lit') {
      inspector.setMode(currentInspectMode);
    }
    setActiveButton(currentInspectMode);

    const entry = manifestByStem.get(stem) || {};
    metadata.update({
      vertexCount: result.vertexCount,
      triangleCount: result.triangleCount,
      fileSize: entry.glb_bytes,
      seconds: entry.seconds,
    });

    needsRender = true;
    return result;
  } catch (err) {
    console.error('Failed to load model', err);
    statusEl.textContent = 'Load failed';
    throw err;
  }
}

screenshotBtn.addEventListener('click', () => {
  if (!activeStem) return;
  takeScreenshot({
    renderer,
    scene,
    camera,
    stem: activeStem,
    viewName: currentInspectMode,
  }).catch((err) => console.error('Screenshot failed', err));
});

const gallery = await createGallery({
  container: galleryRail,
  onSelect: (stem) => {
    gallery.setActive(stem);
    writeState({ model: stem });
    loadStem(stem);
  },
});

const entries = gallery.getEntries();
for (const entry of entries) manifestByStem.set(entry.stem, entry);

const initialStem = (state.model && manifestByStem.has(state.model))
  ? state.model
  : (entries[0]?.stem ?? null);

if (initialStem) {
  gallery.setActive(initialStem);
  writeState({ model: initialStem });
  loadStem(initialStem).then(() => {
    if (state.shot === 1) {
      setTimeout(() => {
        takeScreenshot({
          renderer,
          scene,
          camera,
          stem: activeStem,
          viewName: currentInspectMode,
        }).then(() => {
          window.__arcaShotDone = true;
        }).catch((err) => {
          console.error('Headless screenshot failed', err);
          window.__arcaShotDone = true;
        });
      }, 500);
    }
  });
} else {
  statusEl.textContent = 'No models in manifest';
}
