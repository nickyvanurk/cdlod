import * as THREE from 'three';

import boundsFs from './bounds.fs';
import boundsVs from './bounds.vs';

/**
 * Samples the terrain height field into a CPU-readable grid over a square region.
 *
 * The terrain is analytic and lives in GLSL, so this evaluates it by rendering the same
 * terrain_common.glsl function into a render target and reading it back, rather than porting
 * the noise to TypeScript. A port would be a second implementation of the same maths that has
 * to stay bit-compatible with the shader forever; the moment it drifts, the results silently
 * stop matching the geometry.
 *
 * Covers the whole map, giving quadtree nodes their AABB min/max. Heights come back packed
 * into RGBA8 (see bounds.fs), so it can be refreshed on demand -- regenerating on a new seed
 * is effectively free.
 */
export class TerrainBounds {
  private target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private pixels: Uint8Array;

  /** Normalized 0..1 heights, row-major. Row 0 is +z; see update() on why there is no flip. */
  readonly data: Float32Array;

  /** Centre of the sampled region, in world XZ. */
  readonly center = new THREE.Vector2();

  constructor(
    readonly size: number,
    public region: number,
    uniforms: Record<string, THREE.IUniform>
  ) {
    // Byte target, not float: bounds.fs packs height into R+G at 16 bits. See there for why.
    this.target = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
    });

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...uniforms,
        probeCenter: { value: new THREE.Vector2() },
        probeSize: { value: region },
      },
      vertexShader: boundsVs,
      fragmentShader: boundsFs,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material));

    // readRenderTargetPixels needs RGBA; height is packed across R and G.
    this.pixels = new Uint8Array(size * size * 4);
    this.data = new Float32Array(size * size);
  }

  update(renderer: THREE.WebGLRenderer, centerX = 0, centerZ = 0) {
    this.center.set(centerX, centerZ);
    this.material.uniforms.probeCenter.value.set(centerX, centerZ);
    this.material.uniforms.probeSize.value = this.region;

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.readRenderTargetPixels(this.target, 0, 0, this.size, this.size, this.pixels);
    renderer.setRenderTarget(prevTarget);

    // Unpack R + G/255 back to 0..1, matching the pack in bounds.fs.
    //
    // No row flip. readRenderTargetPixels returns row 0 = the bottom of the target = uv.y 0,
    // which bounds.fs maps to +z -- the same place gridFromWorld() puts row 0. Flipping here
    // mirrors the grid in Z against every lookup into it, which silently hands each quadtree
    // node the height bounds from the opposite side of the map.
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = (this.pixels[i * 4] + this.pixels[i * 4 + 1] / 255) / 255;
    }
  }

  /**
   * Fractional grid index for a world XZ, and its inverse.
   *
   * These are the only place world and grid coordinates convert, deliberately. bounds.fs
   * renders sample i at the *centre* of its texel -- uv (i + 0.5) / size -- so the grid is
   * inset half a texel from the map edges, and the inverse needs the matching -0.5. Every
   * caller went through its own arithmetic before, which drifted by half a texel and, in one
   * case, mirrored the whole grid in Z.
   */
  gridFromWorld(x: number, z: number) {
    return {
      fx: ((x - this.center.x) / this.region + 0.5) * this.size - 0.5,
      fy: (0.5 - (z - this.center.y) / this.region) * this.size - 0.5,
    };
  }

  worldFromGrid(tx: number, ty: number) {
    return {
      x: this.center.x + ((tx + 0.5) / this.size - 0.5) * this.region,
      z: this.center.y + (0.5 - (ty + 0.5) / this.size) * this.region,
    };
  }

  /** Nearest sample, clamped to the grid. */
  at(cx: number, cy: number) {
    const x = Math.min(this.size - 1, Math.max(0, cx));
    const y = Math.min(this.size - 1, Math.max(0, cy));
    return this.data[y * this.size + x];
  }

  /**
   * Highest normalized height within `reach` samples of a world XZ.
   *
   * Max, not nearest: the real surface between two samples can sit above both of them, so a
   * nearest lookup will happily place a camera inside a hill.
   */
  sampleMax(x: number, z: number, reach = 2) {
    const { fx, fy } = this.gridFromWorld(x, z);
    let max = 0;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        max = Math.max(max, this.at(Math.round(fx) + dx, Math.round(fy) + dy));
      }
    }
    return max;
  }
}
