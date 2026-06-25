// Screenshot export. Captures the canvas at 2x viewport resolution and
// downloads it as a PNG. We bump the renderer's pixel ratio to 2 (not
// current * 2) so the output is always 2x the CSS viewport, matching the
// SPEC promise, then restore the original ratio and render once more so
// the on-screen view is not left at the boosted resolution.

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function takeScreenshot({ renderer, scene, camera, stem, viewName }) {
  return new Promise((resolve, reject) => {
    const originalPR = renderer.getPixelRatio();
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;

    function restore() {
      renderer.setPixelRatio(originalPR);
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    }

    try {
      renderer.setPixelRatio(2);
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    } catch (err) {
      restore();
      reject(err);
      return;
    }

    renderer.domElement.toBlob((blob) => {
      restore();
      if (!blob) {
        reject(new Error('canvas.toBlob returned null'));
        return;
      }
      const filename = `${stem}_${viewName}.png`;
      triggerDownload(blob, filename);
      resolve(filename);
    }, 'image/png');
  });
}
