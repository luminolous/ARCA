// Compare mode wiring. Given a left and right pane (each its own scene,
// camera, controls, lighting, inspector), this module installs the
// camera-sync handlers and exposes a small API to enable or disable the
// sync at runtime. A guard flag prevents the two 'change' listeners
// from ping-ponging into infinite recursion when sync writes to the
// other pane's camera.

export function createCompareManager(leftPane, rightPane, initialSync = true) {
  let syncEnabled = initialSync;
  let syncing = false;

  function copy(src, dst) {
    if (syncing) return;
    syncing = true;
    dst.camera.position.copy(src.camera.position);
    dst.camera.quaternion.copy(src.camera.quaternion);
    dst.camera.zoom = src.camera.zoom;
    dst.camera.updateProjectionMatrix();
    dst.controls.target.copy(src.controls.target);
    dst.controls.update();
    dst.requestRender();
    syncing = false;
  }

  const onLeft = () => { if (syncEnabled) copy(leftPane, rightPane); };
  const onRight = () => { if (syncEnabled) copy(rightPane, leftPane); };

  leftPane.controls.addEventListener('change', onLeft);
  rightPane.controls.addEventListener('change', onRight);

  function setSync(enabled) {
    syncEnabled = !!enabled;
    if (syncEnabled) copy(leftPane, rightPane);
  }

  function getSync() {
    return syncEnabled;
  }

  function dispose() {
    leftPane.controls.removeEventListener('change', onLeft);
    rightPane.controls.removeEventListener('change', onRight);
  }

  return { setSync, getSync, dispose };
}
