// Entry point. Builds the WebGL renderer, applies ARCA's tone mapping and
// paper clear color, and renders a single frame. No scene content yet; later
// stages mount the viewer, lighting, and inspect modules onto this renderer.

import * as THREE from 'three';

const canvas = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0xF7F5F0, 1.0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 3);

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

renderer.render(scene, camera);
