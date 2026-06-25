// Entry point. Builds the WebGL renderer with ARCA's tone mapping and paper
// clear color, sets up a placeholder ambient + directional light pair, then
// hands the scene and camera to the viewer module to load the first GLB.
// Renders lazily: only when the controls report a change or damping is still
// settling. HDRI lighting arrives in stage 2.

import * as THREE from 'three';
import { createViewer, loadModel } from './viewer.js';
import { createLightingManager } from './lighting.js';

const canvas = document.getElementById('stage');
const statusEl = document.getElementById('status');
const hdriSelect = document.getElementById('hdri-select');

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

const lighting = createLightingManager(renderer, scene);
lighting.loadHDRI('studio').then(() => { needsRender = true; });

const controls = createViewer({ canvas, scene, camera, renderer });

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  needsRender = true;
}

let needsRender = true;
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

statusEl.textContent = 'Loading...';

const modelUrl = './models/artefak_26824_low.glb';
const stem = 'artefak_26824';

loadModel(modelUrl, scene, camera, controls, renderer)
  .then(() => {
    statusEl.textContent = `Loaded ${stem}`;
    needsRender = true;
  })
  .catch((err) => {
    console.error('Failed to load model', err);
    statusEl.textContent = 'Load failed';
  });

hdriSelect.addEventListener('change', (e) => {
  lighting.loadHDRI(e.target.value).then(() => { needsRender = true; });
});
