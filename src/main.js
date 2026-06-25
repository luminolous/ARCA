// Entry point. Builds the WebGL renderer, attaches HDRI lighting and the
// gallery rail, and drives model swaps. Each swap disposes the previous
// model's geometry, materials, and textures, then re-applies the current
// inspect mode so the user sees their chosen view on the new artifact.
// Renders lazily: only when controls report a change or damping settles.

import * as THREE from 'three';
import { createViewer, loadModel } from './viewer.js';
import { createLightingManager } from './lighting.js';
import { createInspector, INSPECT_MODES } from './inspect.js';
import { createGallery } from './gallery.js';

const canvas = document.getElementById('stage');
const statusEl = document.getElementById('status');
const hdriSelect = document.getElementById('hdri-select');
const inspectPanel = document.getElementById('inspect-panel');
const galleryRail = document.getElementById('gallery-rail');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0xF7F5F0, 1.0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF7F5F0);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
camera.position.set(0, 0, 3);

let needsRender = true;

const lighting = createLightingManager(renderer, scene);
lighting.loadHDRI('studio').then(() => { needsRender = true; });

const controls = createViewer({ canvas, scene, camera, renderer });

let activeMesh = null;
let activeRoot = null;
let currentInspectMode = 'lit';
const inspector = createInspector(() => activeMesh);

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
    needsRender = true;
  });
}

hdriSelect.addEventListener('change', (e) => {
  lighting.loadHDRI(e.target.value).then(() => { needsRender = true; });
});

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
    result.object.traverse((node) => {
      if (node.isMesh && !activeMesh) activeMesh = node;
    });
    statusEl.textContent = `Loaded ${stem}`;
    enableInspectButtons();
    if (currentInspectMode !== 'lit') {
      inspector.setMode(currentInspectMode);
    }
    setActiveButton(currentInspectMode);
    needsRender = true;
  } catch (err) {
    console.error('Failed to load model', err);
    statusEl.textContent = 'Load failed';
  }
}

const gallery = await createGallery({
  container: galleryRail,
  onSelect: (stem) => {
    gallery.setActive(stem);
    loadStem(stem);
  },
});

const entries = gallery.getEntries();
if (entries.length > 0) {
  const firstStem = entries[0].stem;
  gallery.setActive(firstStem);
  loadStem(firstStem);
} else {
  statusEl.textContent = 'No models in manifest';
}
