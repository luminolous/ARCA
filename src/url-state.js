// URL state. Treats the query string as the single source of truth for
// every shareable view setting. readState parses and validates against
// SPEC 5.2 defaults; writeState merges a partial update and rewrites the
// URL with history.replaceState so the back button is not polluted.
// subscribe lets modules react to programmatic state changes; only used
// rarely in the MVP, but cheap to expose for later stages.

const DEFAULTS = Object.freeze({
  model: null,
  hdri: 'studio',
  exposure: 1.0,
  tone: 'aces',
  view: 'lit',
  mode: 'single',
  model2: null,
  sync: 1,
  bg: 1,
  shot: 0,
  yaw: null,
  pitch: null,
});

const HDRI_VALUES = new Set(['studio', 'outdoor', 'museum']);
const TONE_VALUES = new Set(['aces', 'reinhard', 'linear']);
const VIEW_VALUES = new Set(['lit', 'wireframe', 'basecolor', 'normal-vec', 'normal-map', 'roughness']);
const MODE_VALUES = new Set(['single', 'compare']);

const subscribers = new Set();
let currentState = null;

function clampNumber(value, fallback, min, max) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseFlag(value, fallback) {
  if (value === '0' || value === '1') return parseInt(value, 10);
  return fallback;
}

export function readState() {
  if (currentState) return currentState;
  const params = new URLSearchParams(window.location.search);

  const state = {
    model: params.get('model') || DEFAULTS.model,
    hdri: HDRI_VALUES.has(params.get('hdri')) ? params.get('hdri') : DEFAULTS.hdri,
    exposure: clampNumber(params.get('exposure'), DEFAULTS.exposure, 0.2, 3.0),
    tone: TONE_VALUES.has(params.get('tone')) ? params.get('tone') : DEFAULTS.tone,
    view: VIEW_VALUES.has(params.get('view')) ? params.get('view') : DEFAULTS.view,
    mode: MODE_VALUES.has(params.get('mode')) ? params.get('mode') : DEFAULTS.mode,
    model2: params.get('model2') || DEFAULTS.model2,
    sync: parseFlag(params.get('sync'), DEFAULTS.sync),
    bg: parseFlag(params.get('bg'), DEFAULTS.bg),
    shot: parseFlag(params.get('shot'), DEFAULTS.shot),
    yaw: params.get('yaw') !== null ? clampNumber(params.get('yaw'), null, -180, 180) : null,
    pitch: params.get('pitch') !== null ? clampNumber(params.get('pitch'), null, -89, 89) : null,
  };

  currentState = state;
  return state;
}

function serialize(state) {
  const params = new URLSearchParams();
  if (state.model) params.set('model', state.model);
  if (state.hdri !== DEFAULTS.hdri) params.set('hdri', state.hdri);
  if (Math.abs(state.exposure - DEFAULTS.exposure) > 1e-6) params.set('exposure', state.exposure.toFixed(2));
  if (state.tone !== DEFAULTS.tone) params.set('tone', state.tone);
  if (state.view !== DEFAULTS.view) params.set('view', state.view);
  if (state.mode !== DEFAULTS.mode) params.set('mode', state.mode);
  if (state.mode === 'compare') {
    if (state.model2) params.set('model2', state.model2);
    if (state.sync !== DEFAULTS.sync) params.set('sync', String(state.sync));
  }
  if (state.bg !== DEFAULTS.bg) params.set('bg', String(state.bg));
  if (state.shot !== DEFAULTS.shot) params.set('shot', String(state.shot));
  if (state.yaw != null) params.set('yaw', state.yaw.toFixed(2));
  if (state.pitch != null) params.set('pitch', state.pitch.toFixed(2));
  return params.toString();
}

export function writeState(partial) {
  const next = { ...readState(), ...partial };
  currentState = next;
  const query = serialize(next);
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', url);
  for (const cb of subscribers) cb(next);
  return next;
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export const URL_DEFAULTS = DEFAULTS;
