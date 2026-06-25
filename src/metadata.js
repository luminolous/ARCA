// Metadata overlay. Builds a small set of hairline pills that show the
// active model's vertex count, triangle count, file size, and (when
// available) reconstruction time. Numbers go through Intl.NumberFormat so
// they read the same on every locale, and file size collapses to kB or
// MB at the 1 MB threshold.

const NUMBER = new Intl.NumberFormat('en-US');

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSeconds(seconds) {
  if (seconds == null) return '—';
  return `${seconds.toFixed(2)} s`;
}

function buildPill(label) {
  const pill = document.createElement('div');
  pill.className = 'pill';
  const lab = document.createElement('span');
  lab.className = 'pill-label';
  lab.textContent = label;
  const val = document.createElement('span');
  val.className = 'pill-value';
  val.textContent = '—';
  pill.appendChild(lab);
  pill.appendChild(val);
  return { pill, val };
}

export function createMetadataOverlay(container) {
  const verts = buildPill('VERTS');
  const tris  = buildPill('TRIS');
  const size  = buildPill('SIZE');
  const secs  = buildPill('TIME');
  secs.pill.hidden = true;

  container.append(verts.pill, tris.pill, size.pill, secs.pill);

  function update({ vertexCount, triangleCount, fileSize, seconds }) {
    verts.val.textContent = vertexCount != null ? NUMBER.format(vertexCount) : '—';
    tris.val.textContent  = triangleCount != null ? NUMBER.format(Math.round(triangleCount)) : '—';
    size.val.textContent  = formatBytes(fileSize);
    if (seconds != null) {
      secs.pill.hidden = false;
      secs.val.textContent = formatSeconds(seconds);
    } else {
      secs.pill.hidden = true;
    }
  }

  return { update };
}
