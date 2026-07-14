# [CDLOD](https://nickvanurk.com/cdlod/)

A terrain renderer built on **continuous distance-dependent level of detail**, the algorithm
described in Filip Strugar's [paper](https://github.com/fstrugar/CDLOD/blob/master/cdlod_paper_latest.pdf).
It draws a 16km × 16km landscape from the horizon down to the grass under the camera, in a
single draw call, with no popping between detail levels — and nothing to download, because
the terrain is generated on the GPU rather than loaded from a heightmap.

![Screenshot](docs/screenshot.png)

> 🌟 If you find this project interesting, please consider giving it a star — it helps others
> discover it too!

🌍 **Try it now at [nickvanurk.com/cdlod](https://nickvanurk.com/cdlod/)**

## :blush: **Why?**

This started with Breath of the Wild. I wanted to build a world that felt worth crossing like
that one does, and figured the ground was a sensible place to begin. The ground turned out to
be a rabbit hole.

What caught me was view distance. Cresting a ridge and watching the land roll out until it
dissolves into haze is most of why Hyrule feels worth walking across — and it's also the
thing that quietly bankrupts you. A mesh dense enough to look right underfoot is billions of
triangles by the time it reaches the horizon; one coarse enough to reach the horizon is a
faceted mess up close. So I went looking for how anyone affords both at once, and fell into a
long detour through terrain rendering.

Most of the answers trade one artifact for another. Swap a chunk for a finer one and the
ground visibly jumps. Stitch chunks of different densities together and cracks open along
every seam. CDLOD was the one that didn't make me choose: a quadtree picks the detail level
per region by distance, and each patch's vertices *morph* toward the shape of the coarser
level as they approach its range — so by the time the swap happens, the geometry is already
sitting there. Nothing pops. It costs a few lines in the vertex shader and nothing at all on
the CPU. That trick was worth building to understand rather than just reading about.

The project was originally fed by a 4km satellite heightmap, which needed 122MB of downloads
to render its first frame and, at a 0.63 height-to-width ratio, was more cliff than
landscape. It has since been rewritten around an **analytic terrain field evaluated in the
shader** — no heightmap, no generation step, no load cost at any size. That bought a map 4×
wider with real distance to draw, which is rather the point of a CDLOD demo. The 16384 units
are a power of two picked for the quadtree; that this lands within rounding of the 16km ×
16km of terrain Breath of the Wild's own engine draws around Hyrule was a happy accident, and
a nice place to have ended up. The trade is erosion — droplet simulation won't run in a
shader, so there are no carved river valleys and the terrain stays noise-only.
[`docs/plans`](docs/plans) documents that rewrite, including the several grid-sampled designs
that were tried and thrown away first.

## 🧪 What's Included

- **Quadtree LOD selection** — 8 levels over a 16km map, from 2km nodes on the horizon down
  to 64m nodes (~1 unit per vertex) underfoot
- **Vertex morphing** between levels, so detail changes are continuous instead of popping
- **Frustum culling** against per-node AABBs, with bounds derived from the terrain field
  itself so the boxes hug the ground instead of spanning the whole height range
- **Analytic GPU terrain** — domain-warped ridged multifractal with a continent mask and
  2.6km peaks, evaluated in GLSL with no heightmap anywhere
- **Seeded worlds** — any integer is a different landscape, and regenerating costs a uniform
  write plus one bounds pass (~33ms) rather than a rebuild
- **Height and slope shading** — depth-graded water, sand, noise-masked forest, and a
  snowline that leaves steep faces as bare rock, with aerial-perspective fog carrying the
  sense of scale
- Roughly 2M triangles at 60 FPS in **one draw call**, via a single instanced patch mesh

### Controls

Drag to orbit, scroll to zoom, right-drag to pan.

| Control | What it does |
| --- | --- |
| Wireframe | Shows the patch grid, and the morphing in action |
| LOD Colors | Tints each level, coarsest red through finest green |
| AABB | Draws the quadtree bounding boxes used for culling |
| Max Height | Rescales the peaks live, from flat to 5000m |
| Debug Camera | Detaches the view so you can fly out and watch LOD selection happen |
| Seed / Random Seed | Type a seed for a specific world, or roll a new one |

Keys <kbd>1</kbd> and <kbd>2</kbd> also switch between the main and debug cameras.

## :rocket: Technologies Used

- TypeScript
- Three.js
- GLSL
- lil-gui
- Vite

## 🛠️ Installation

These instructions will get you a copy of the project up and running on your local machine.

### Prerequisites

- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Node.js](https://nodejs.org/en/download/package-manager/)
- [npm](https://www.npmjs.com/get-npm)

The culling bounds pass reads back a float render target, so it needs a GPU with
`EXT_color_buffer_float` — any WebGL2 browser from the last several years has it.

### Installation

```
$ git clone https://github.com/nickyvanurk/cdlod
$ cd ./cdlod
$ npm i
$ npm run dev
```

## License

This project is licensed under the [MIT License](./LICENSE).
