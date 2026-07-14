# Procedural Terrain

## Problem

The demo downloaded 122 MB before rendering a frame: `src/texture.png` (89 MB satellite
albedo) and `src/heightmap.raw` (33 MB, 4096² uint16). Both were committed, so `.git` is
142 MB as well.

Worse for a CDLOD demo, the map was only 4096 units across. CDLOD exists to draw terrain far
into the distance; a 4km map with 2.6km peaks (height:width 0.63) has no distance to draw
and is unrealistically steep.

## Approach

The terrain is an **analytic field evaluated in the shader**. There is no heightmap, no
generation step, and no load cost at any map size. Colour is computed from height and slope,
so the albedo texture is deleted rather than replaced.

Map is 16km × 16km with 2.6km peaks — height:width ~0.16, roughly alpine.

## Why analytic, and not a baked heightmap

This was arrived at the hard way. Every intermediate design that sampled height from a grid
produced a different artifact, and all of them were the same underlying problem — a
continuous surface reconstructed from discrete samples, then differentiated for shading:

- **Bilinear filtering** is C0. Height is continuous but its gradient is piecewise-constant
  *within each texel*, so every texel shades as one flat facet. Facets of similar slope
  merge into terraces whose edges stair-step along the texel grid.
- **Smoothstep weights** are C1 but force the gradient to *zero* at every cell boundary,
  stamping a regular waffle into the shading. Worse than bilinear, not better.
- **Catmull-Rom** (C1, continuous non-zero gradient) fixed the terracing but only moved the
  problem, since the detail layered on top still came from a lattice.
- **Value noise** interpolates hashes on an integer lattice and shows that lattice
  regardless of interpolant.
- **`fract(p * vec2(123.34, 456.21))` hashes** collapse at 16km world coordinates: the
  intermediates reach the tens of thousands, where float32 `fract()` retains only a few bits
  and the hash degenerates into a lattice. The old 4km map never pushed coordinates far
  enough to expose it.

An analytic field has no grid to alias against. All of the above vanish at once, and it
costs nothing to start and works at any extent.

The trade is **erosion**. Droplet simulation cannot run in a shader, so there are no
dendritic river valleys. This is a deliberate choice: the terrain is noise-only, Valheim
style, and scale is what the demo is selling.

## Structure

`terrain_common.glsl` holds the whole definition and is included by `terrain.vs`,
`terrain.fs` and `bounds.fs`, so geometry, shading and culling bounds cannot disagree:

- Simplex noise (Ashima/Gustavson) — gradient noise, not value noise.
- Domain-warped ridged multifractal for mountains, warp kept ≤0.2 (past that, warping fbm by
  fbm is the marble recipe and terrain reads as polished stone).
- A continent mask biasing high ground north-west and ocean south-east.
- A **plateau term**: inland is lifted and ridges only add relief on top. Without it, ridge
  troughs fall back to the coastal base and the range renders as a row of isolated needles
  instead of high country.

`terrain.vs` evaluates height and normal per vertex and passes both as varyings. Per-vertex,
not per-fragment: the field costs ~20 noise samples per evaluation, affordable across
vertices but not pixels. Normal `eps` tracks vertex spacing so coarse distant nodes sample a
correspondingly smoother surface rather than aliasing against detail their geometry cannot
carry.

`terrain.fs` bands colour by altitude and slope: depth-graded water, a narrow sand band
(most land sits in the lowest tenth of the range, so a wide band beaches the whole coast),
patchy noise-masked forest, and a slope-dependent snowline that leaves steep faces as bare
rock. Aerial-perspective fog is doing most of the work of conveying scale — without it a
distant range reads as a small nearby ridge.

Ridged noise runs nine octaves, taking the finest detail to roughly 15m across the map. That
is what gives the light something to catch close up; at seven the ground was a smooth mass.
The top octaves push the noise coordinate past simplex's `mod289` period, so the pattern
repeats a few times over the map — at `0.5^8` amplitude that is a couple of metres of relief,
which the eye cannot pick out.

## Lighting and ground textures

Direct light is a plain hillshade; ambient is hemispheric (sky above, bounced ground below).
Highlights roll off rather than clamp: snow is near-white albedo, so direct plus ambient
drives every lit face past 1.0 and clips them to identical flat white, erasing the relief the
fine octaves buy.

Three tiled ground textures (grass, dirt, rock, ~848KB total) blend in near the camera,
driven by the same altitude and slope terms as the colour bands, and fade back to flat band
colour with distance.

They are blended as **colour, not multiplied as detail maps**. They come from a stylised
low-poly pack and are nearly flat — the grass map's standard deviation is ~0.006 — so
modulating with them contributes nothing visible. Used as colour they at least carry a
palette. Flat ground is intrinsic to that art style, which expects scattered vegetation to
carry the close-up; this demo does it with terrain relief instead.

## Culling bounds

Quadtree AABBs need per-node min/max on the CPU, but the field lives in GLSL.
`terrain_bounds.ts` renders the same `terrain_common.glsl` into a 512² float target and
reads it back, rather than porting the noise to TypeScript. A port would be a second
implementation that must stay bit-compatible forever; the moment it drifts, bounds silently
stop matching geometry and nodes cull while on screen.

Bounds sample every ~32m, so AABBs are padded by `BOUNDS_MARGIN` — a summit between two
samples is invisible to the scan.

Node min/max is a bottom-up reduction (leaves scan their span, parents reduce children). The
original four-corner sampling survived smooth satellite data but clips peaks between corners.

World and grid coordinates convert in exactly one place, `gridFromWorld` / `worldFromGrid`.
This is not tidiness. `bounds.fs` renders sample *i* at its texel centre, so the grid is inset
half a texel and the inverse needs a matching `-0.5`; callers doing their own arithmetic
drifted by half a texel, and one earlier version mirrored the grid in Z, silently handing
every node the bounds of the opposite side of the map. That survived review from altitude —
the frustum covered enough that the wrong boxes still overlapped — and only fell apart at
ground level.

## Configuration

`MAP_SIZE` is the single knob. Quadtree depth, LOD ranges, camera, fog density and far plane
all derive from it. `LOD_LEVELS` is 8, giving a 64-unit finest node (~1 unit/vertex).

Seeding translates the noise domain, so `Regenerate` is a uniform write plus one bounds
re-render: ~33ms, versus ~5s for the CPU generator it replaced.

## Out of scope

Removing the assets from git history. Deleting the files fixes the demo download but `.git`
stays 142 MB; a history rewrite is a separate decision with consequences for anyone who has
cloned the repo.
