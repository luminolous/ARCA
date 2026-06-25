// Inspect modes. Swaps the active mesh's material between the original
// PBR look and a handful of debug visualizations: wireframe, base color,
// normal-as-color, normal map flat, and a roughness gray. The original
// MeshStandardMaterial is cached on first switch and restored when the
// user picks "lit". Each swapped-in material is disposed when replaced
// so we do not leak GPU resources across switches.

import * as THREE from 'three';

export const INSPECT_MODES = ['lit', 'wireframe', 'basecolor', 'normal-vec', 'normal-map', 'roughness'];

export function createInspector(getActiveMesh) {
  let originalMaterial = null;
  let swappedMaterial = null;
  let currentMode = 'lit';

  function cacheOriginalIfNeeded(mesh) {
    if (originalMaterial === null) {
      originalMaterial = mesh.material;
    }
  }

  function disposeSwapped() {
    if (swappedMaterial && swappedMaterial !== originalMaterial) {
      swappedMaterial.dispose();
    }
    swappedMaterial = null;
  }

  function buildMaterial(mode, original) {
    switch (mode) {
      case 'wireframe': {
        const m = original.clone();
        m.wireframe = true;
        return m;
      }
      case 'basecolor':
        return new THREE.MeshBasicMaterial({ map: original.map ?? null });
      case 'normal-vec':
        return new THREE.MeshNormalMaterial();
      case 'normal-map':
        // Display the tangent-space normal map flat, as if inspecting the
        // texture itself. No lighting, no normal perturbation applied.
        return new THREE.MeshBasicMaterial({ map: original.normalMap ?? null });
      case 'roughness': {
        // Known limitation: the Jobdesk 1 GLBs encode metallic/roughness as
        // material factors, not textures. The result here is therefore a
        // flat gray equal to roughnessFactor. When the upstream pipeline
        // starts emitting metallicRoughnessTexture this branch will need
        // to read the green channel of that map instead.
        const r = original.roughness ?? 1.0;
        return new THREE.MeshBasicMaterial({ color: new THREE.Color(r, r, r) });
      }
      default:
        return null;
    }
  }

  function setMode(mode) {
    const mesh = getActiveMesh();
    if (!mesh) return;
    cacheOriginalIfNeeded(mesh);

    if (mode === 'lit') {
      disposeSwapped();
      mesh.material = originalMaterial;
      currentMode = 'lit';
      return;
    }

    const next = buildMaterial(mode, originalMaterial);
    if (!next) return;

    disposeSwapped();
    mesh.material = next;
    swappedMaterial = next;
    currentMode = mode;
  }

  function reset() {
    disposeSwapped();
    originalMaterial = null;
    currentMode = 'lit';
  }

  function getMode() {
    return currentMode;
  }

  return { setMode, getMode, reset };
}
