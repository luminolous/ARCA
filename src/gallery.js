// Gallery rail. Fetches manifest.json once on init, renders one 96px card
// per artifact with its thumbnail and stem, and calls onSelect(stem) when
// the user clicks. setActive(stem) updates which card carries the indigo
// border that marks the currently loaded model.

export async function createGallery({ container, onSelect }) {
  const res = await fetch('./manifest.json');
  if (!res.ok) {
    throw new Error(`manifest.json fetch failed: ${res.status}`);
  }
  const entries = await res.json();

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';

  const cardByStem = new Map();
  let activeStem = null;

  for (const entry of entries) {
    const stem = entry.stem;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card';
    card.dataset.stem = stem;
    card.setAttribute('aria-label', stem);

    const img = document.createElement('img');
    img.className = 'gallery-thumb';
    img.src = `./thumbnails/${stem}.webp`;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 96;
    img.height = 96;

    const label = document.createElement('span');
    label.className = 'gallery-stem';
    label.textContent = stem;

    card.appendChild(img);
    card.appendChild(label);
    card.addEventListener('click', () => onSelect(stem));

    grid.appendChild(card);
    cardByStem.set(stem, card);
  }

  container.appendChild(grid);

  function setActive(stem) {
    if (activeStem && cardByStem.has(activeStem)) {
      cardByStem.get(activeStem).classList.remove('is-active');
    }
    activeStem = stem;
    if (stem && cardByStem.has(stem)) {
      cardByStem.get(stem).classList.add('is-active');
    }
  }

  function getEntries() {
    return entries;
  }

  return { setActive, getEntries };
}
