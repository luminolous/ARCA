# ARCA

**Artefact Reconstruction with Computer graphics Application** — an interactive web viewer for Indonesian cultural artifacts reconstructed into 3D from a single photograph. Open one in the browser, orbit it, swap the lighting, inspect the materials. No installation, no plugin, runs on a laptop.

ARCA is the Jobdesk 3 deliverable of a five-person Computer Graphics final project. The 3D models come from a separate Stable Fast 3D pipeline (Jobdesk 1). ARCA itself does no reconstruction.

## Demo

Live: https://huggingface.co/spaces/lumicero/arca

## Run locally

```bash
git clone https://github.com/luminolous/arca.git
cd arca
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`).

Required assets before the viewer is useful:

1. **GLB models**: Jobdesk 1 outputs in `public/models/`.
2. **HDRI environments**: download from polyhaven.com into `public/hdri/` (see [SPEC.md](./SPEC.md) section 3.3 for filenames).
3. **Manifest and thumbnails**: run `notebooks/01_offline_assets.ipynb` once to generate `public/manifest.json` and `public/thumbnails/`.

## Build

```bash
npm run build
```

Output lands in `dist/`. The GitHub Action in [.github/workflows/deploy-hf.yml](./.github/workflows/deploy-hf.yml) pushes this to the Hugging Face Space on every commit to `main`.

## Features

- Load any GLB from the artifact set with auto-fit camera and OrbitControls
- Three HDRI environment presets (studio, outdoor, museum)
- Wireframe and four material-map inspect modes (base color, normal vector, normal map, roughness)
- Gallery of all artifacts with click-to-load
- Side-by-side compare two artifacts with optional camera sync
- Exposure and tone mapping controls (ACES, Reinhard, Linear)
- Metadata overlay showing vertex count, triangle count, file size, and reconstruction time
- 2x screenshot export
- Shareable URLs that round-trip every view setting
- Collapsible gallery and inspect rails so the artifact can take the full stage

## Project structure

| Document | Purpose |
|---|---|
| [SPEC.md](./SPEC.md) | What ARCA does, inputs, outputs, URL schema, all feature definitions |
| [DESIGN.md](./DESIGN.md) | Visual design system: palette, typography, layout, component patterns |
| [PROMPTS.md](./PROMPTS.md) | Build sequence, one prompt per stage |
| [CLAUDE.md](./CLAUDE.md) | Project conventions for AI-assisted development |

```
src/
├── main.js          entry, renderer + scene + pane orchestration
├── viewer.js        GLB load, camera fit, OrbitControls
├── lighting.js      PMREM environment + HDRI switcher
├── inspect.js       wireframe + material-map material swaps
├── compare.js       camera sync for side-by-side panes
├── gallery.js       thumbnail grid + click-to-load
├── metadata.js      bottom-bar pill populator
├── screenshot.js    2x PNG export
├── url-state.js     shareable URL read/write
└── style.css        all styles
```

## Deployment

GitHub repository is the source of truth. The workflow at [.github/workflows/deploy-hf.yml](./.github/workflows/deploy-hf.yml) runs on every push to `main`:

1. `npm ci`, `npm run build`.
2. Downloads the Space's current `README.md` to preserve its YAML front matter.
3. Uploads `dist/` to the Hugging Face Space via `huggingface_hub.HfApi.upload_folder` with `delete_patterns=['*']`.

Required GitHub configuration:

| Kind | Name | Value |
|---|---|---|
| Repository secret | `HF_TOKEN` | Fine-grained HF token with write access to the Space |
| Repository variable | `HF_SPACE` | The Space repo id, e.g. `lumicero/arca` |

The Space's README YAML must declare `sdk: static`.

## Team and credits

| Role | Responsibility |
|---|---|
| Jobdesk 1 | Preprocessing, Stable Fast 3D inference, GLB export |
| Jobdesk 2 | Dataset curation and evaluation set assembly |
| Jobdesk 3 | This viewer |
| Jobdesk 4 | Quantitative evaluation and failure analysis |
| Jobdesk 5 | Final report and documentation |

Upstream model: [Stable Fast 3D](https://github.com/Stability-AI/stable-fast-3d) by Stability AI.

HDRI environments from [Poly Haven](https://polyhaven.com) under CC0.

## License

Source code under MIT. Cultural artifact images respect the original sources cited in the Jobdesk 2 dataset record.
