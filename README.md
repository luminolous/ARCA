# ARCA

**Artefact Reconstruction with Computer graphics Application**

An interactive web viewer for Indonesian cultural artifacts reconstructed into 3D from a single photograph. Open one in your browser, rotate it, change the lighting, inspect the materials. No installation, no plugin, runs on a laptop.

ARCA is the Jobdesk 3 deliverable of a five-person Computer Graphics course final project. The 3D models come from a separate Stable Fast 3D pipeline (Jobdesk 1). ARCA itself does no reconstruction.

## Demo

Live: https://huggingface.co/spaces/lumicero/arca (filled in after first deploy)

## Run locally

```bash
git clone https://github.com/luminolous/arca.git
cd arca
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`).

Required assets before the viewer is useful:

1. **GLB models**: drop your Jobdesk 1 outputs into `public/models/`.
2. **HDRI environments**: download from polyhaven.com and save to `public/hdri/` (see `SPEC.md` section 3.3 for filenames).
3. **Manifest and thumbnails**: run `notebooks/01_offline_assets.ipynb` once to generate `public/manifest.json` and `public/thumbnails/`.

## Build

```bash
npm run build
```

Output lands in `dist/`. The GitHub Action pushes this to the Hugging Face Space on every commit to `main`.

## Project structure

| Document | Purpose |
|---|---|
| [SPEC.md](./SPEC.md) | What ARCA does, inputs, outputs, URL schema, all feature definitions |
| [DESIGN.md](./DESIGN.md) | Visual design system: palette, typography, layout, component patterns |
| [PROMPTS.md](./PROMPTS.md) | Build sequence, one prompt per stage |
| [CLAUDE.md](./CLAUDE.md) | Project conventions for AI-assisted development |

## Features

- Load any GLB from the artifact set
- Three HDRI environment presets (studio, outdoor, museum)
- Wireframe and four material-map inspect modes
- Gallery of all artifacts with click-to-load
- Side-by-side compare two artifacts, with optional camera sync
- Exposure and tone mapping controls
- Metadata overlay showing vertex count, triangle count, file size, reconstruction time
- Screenshot export at 2x resolution
- Shareable URLs that restore every view setting

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

To be confirmed by the team. Source code under MIT by default. Cultural artifact images respect the original sources cited in the Jobdesk 2 dataset record.
