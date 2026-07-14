# Procedural Terrain Generation

## Problem

The demo downloads 122 MB before it renders a single frame: `src/texture.png` (89 MB
satellite albedo) and `src/heightmap.raw` (33 MB, 4096² uint16). Both are committed, so
`.git` is 142 MB as well.

The height data does double duty. It becomes a `DataTexture` the vertex shader samples for
displacement, and it is read on the CPU to compute quadtree AABB min/max for culling. The
fragment shader only samples the albedo — the terrain's entire appearance is baked pixels,
not derived from its shape.

## Approach

Generate height procedurally at load, and compute color in the fragment shader from height
and slope. The albedo texture is deleted rather than replaced: zero bytes on the wire.

## Architecture

One new module, `src/terrain_gen.ts`, exporting:

```ts
generateTerrain(size: number, seed: number): Float32Array  // normalized 0..1, row-major
```

This is the same shape `loadHeightmap` returns today, so `main.ts` swaps one `await` for
one synchronous call and the `DataTexture`, AABB pass, and vertex shader keep working.

Four stages, seed threaded through all of them:

1. **Noise primitives** — seeded 2D simplex, no dependency. A small PRNG permutes the
   gradient table so a seed always reproduces a world.
2. **Base shape** — domain-warped ridged multifractal for mountains, multiplied by a
   low-frequency FBM continent mask that biases elevation high toward one corner and below
   sea level toward the opposite edges.
3. **Erosion** — 200k-droplet hydraulic simulation, in place.
4. **Normalize** — rescale to 0..1, flatten below sea level to a flat seabed.

## Resolution

`mapSize` (world units) and `heightmapSize` (texels) are currently the same variable, both
4096. Decouple them: `mapSize = 4096` so camera, LOD ranges, and quadtree are untouched;
`heightmapSize = 2048`.

The finest LOD sector is 128 world units across with 64 segments — ~2 units per vertex — so
geometry cannot resolve past 2048² anyway, and eroding 16.7M texels costs load time for
nothing.

Two places currently assume the two are equal and must convert world→texel explicitly: the
AABB indexing in `main.ts`, and the `vUv` math in `terrain.vs`.

## Generator detail

**Ridged multifractal.** `1 - abs(simplex(p))` over ~8 octaves, each octave's amplitude
damped by the previous octave's value. The damping keeps crests sharp and connected instead
of bubbly. The coordinate is domain-warped by a second low-frequency FBM first, bending
ridgelines into sinuous ranges rather than a uniform field.

**Erosion.** Each droplet spawns at a random cell, then for ≤64 steps: bilinearly sample the
height gradient, accelerate downhill with inertia, carry sediment. Capacity is proportional
to slope × speed × water, so droplets erode going downhill fast and deposit on flats or
uphill. Erosion and deposition scatter bilinearly across the 4 neighbouring cells — nearest-
cell scatter produces axis-aligned artifacts. Droplets evaporate over their lifetime.

The dendritic drainage pattern is emergent: nobody draws rivers, they fall out of many
droplets independently finding the same downhill paths and deepening them.

## Shading

`terrain.fs` derives everything from the heightmap already bound. Central differences give a
world-space normal:

```glsl
vec3 normal = normalize(vec3(hL - hR, 2.0 * texel * mapSize / maxTerrainHeight, hD - hU));
```

Height and `normal.y` mix through bands: deep teal → shallow teal at the waterline → sand →
green lowland → brown rock → snow.

Two details do most of the visual work:

- **Slope-dependent snowline** — `smoothstep(...) * pow(normal.y, k)`, so snow accumulates on
  flats and shallow slopes while steep faces stay bare rock. This produces the dark exposed
  crests seen in the reference.
- **Forest as a noise mask**, not a band, so lowlands are patchy rather than striped.

A `dot(normal, sunDir)` hillshade replaces the lighting that was baked into the satellite
imagery.

Requires `mapSize` and `maxTerrainHeight` as fragment uniforms (currently vertex-only) and a
new `heightmapTexel` uniform.

## AABB correctness

The current code samples each node's 4 corners for min/max. Satellite data is smooth enough
to survive that; eroded ridges are not — a peak between two corners is clipped from the AABB
and the node pops out of view when looked at.

Since generation is CPU-side, compute exact min/max as a bottom-up quadtree reduction: leaves
scan their texel span, parents take min/max of children.

## GUI

A `Seed` number field and `Regenerate` button in the existing lil-gui panel, calling
`regenerate(seed)`, which reruns generation, refreshes the `DataTexture`, and recomputes
AABBs.

## Out of scope

Removing the assets from git history. Deleting the files fixes the demo download but `.git`
stays 142 MB; a history rewrite is a separate decision with separate consequences for anyone
who has cloned the repo.
