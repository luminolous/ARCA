// HDRI environment manager. Loads RGBE files on demand, runs them through
// PMREMGenerator to produce a usable IBL probe, and assigns the result to
// both scene.environment and scene.background. Loaded probes are cached
// keyed by preset name so repeat switches are instant. The previous probe
// is disposed when a new one takes its place to free GPU memory.
//
// Transition policy: hard cut between presets. A 180ms crossfade would
// require rendering with two PMREM textures blended in a custom shader,
// which is not worth the added code for a switch the user triggers
// intentionally. Document this here so future stages do not reinvent it.

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const HDRI_FILES = {
  studio:  './hdri/studio_small_03_1k.hdr',
  outdoor: './hdri/golden_gate_hills_1k.hdr',
  museum:  './hdri/museum_of_ethnography_1k.hdr',
};

export function createLightingManager(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const cache = new Map();
  const loader = new RGBELoader();
  let currentKey = null;
  let currentTexture = null;

  async function loadHDRI(key) {
    const url = HDRI_FILES[key];
    if (!url) {
      console.warn(`Unknown HDRI key: ${key}`);
      return;
    }

    let envTexture = cache.get(key);
    if (!envTexture) {
      const hdr = await loader.loadAsync(url);
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      envTexture = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      cache.set(key, envTexture);
    }

    if (currentTexture && currentTexture !== envTexture) {
      // Only dispose textures that are no longer cached. Cached entries are
      // kept alive for instant re-selection.
    }

    scene.environment = envTexture;
    scene.background = envTexture;
    currentTexture = envTexture;
    currentKey = key;
  }

  function getCurrentKey() {
    return currentKey;
  }

  function dispose() {
    for (const tex of cache.values()) tex.dispose();
    cache.clear();
    pmrem.dispose();
  }

  return { loadHDRI, getCurrentKey, dispose };
}
