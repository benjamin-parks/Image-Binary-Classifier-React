# Image Binary Classifier

A browser tool for turning an image into a **binary (black & white) mask** by
painting over the parts you want. You tell the app, pixel by pixel, what you
**want** (becomes `1` / white) and what you **don't want** (becomes `0` /
black). Those painted samples build a **color lookup table** that classifies
every remaining pixel in the image.

Everything runs locally in the browser — no server, no upload.

## Features

- **Imports PNG, JPEG, and GeoTIFF/TIFF.** Multi-band and 16-bit/float GeoTIFFs
  are contrast-stretched for display; single-band rasters render as grayscale.
- **Paint what you want / don't want.** Two brushes:
  - **Want** → `1` (white in the output)
  - **Don't want** → `0` (black in the output)
  - plus an **Erase** brush to fix mistakes.
- **Lookup-table classification.** Painting collects the colors under your
  brush into "want" and "don't want" sample sets. Building the table quantizes
  RGB space and, for every color, records the nearest class (1‑nearest‑neighbor).
  Generating the binary is then a fast per-pixel table lookup — fully
  deterministic, no training time.
- **Strictness control.** Decide how close a pixel's color must be to a "want"
  sample before it counts. High strictness keeps only near-exact matches; low
  strictness assigns every pixel to its nearest class.
- **Georeferencing preserved.** When you import a GeoTIFF, the exported binary
  PNG comes with an ESRI world file (`.pgw`) so the mask stays aligned in GIS
  software.
- Pan/zoom canvas, live binary preview, and keyboard shortcuts.

## How to use

1. Click **Import image** and choose a PNG, JPEG, or GeoTIFF.
2. With the **Want** brush, paint over the areas you want to keep (shown green).
3. Switch to **Don't want** and paint the areas to exclude (shown red).
4. Click **Build lookup table** (or just **Generate binary**, which builds it
   automatically) to classify the image.
5. Review the **binary preview**, adjust the strictness slider or add more
   annotations, and rebuild if needed.
6. Click **Download** to save the binary PNG (plus a world file for GeoTIFFs).

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `1` / `2` / `3` | Want / Don't want / Erase brush |
| `[` / `]` | Decrease / increase brush size |
| `F` | Fit image to view |
| `T` | Build lookup table |
| `G` | Generate binary |
| `C` | Clear annotations |

Scroll to zoom; hold **Space** or drag with the middle mouse button to pan.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run lint     # eslint
```

Built with React + Vite. GeoTIFF decoding uses
[`geotiff`](https://github.com/geotiffjs/geotiff.js). The lookup-table build and
binary generation run in a Web Worker to keep the UI responsive.
