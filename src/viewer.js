// Single-model viewer. Wires OrbitControls onto the shared camera and
// exposes a loadModel function that parses a GLB, recenters it at origin,
// and frames the camera so the bounding sphere fills about 70 percent of
// the viewport. The loader is initialized with DRACO and KTX2 helpers so
// that future compressed-tier files load without code changes.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export function createViewer({ canvas, camera, renderer }) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  return controls;
}

export async function loadModel(url, scene, camera, controls, renderer) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/');

  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath('three/examples/jsm/libs/basis/');
  if (renderer) {
    ktx2Loader.detectSupport(renderer);
  }

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.setKTX2Loader(ktx2Loader);

  const gltf = await loader.loadAsync(url);
  const object = gltf.scene;

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = sphere.radius;

  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const fillRatio = 0.7;
  const distance = (radius / fillRatio) / Math.sin(fovRad / 2);

  camera.position.set(0, 0, distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(object);

  let vertexCount = 0;
  let triangleCount = 0;
  object.traverse((node) => {
    if (node.isMesh && node.geometry) {
      const position = node.geometry.attributes.position;
      if (position) vertexCount += position.count;
      const index = node.geometry.index;
      triangleCount += index ? index.count / 3 : (position ? position.count / 3 : 0);
    }
  });

  return { object, vertexCount, triangleCount };
}
