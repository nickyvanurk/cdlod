import type GUI from 'lil-gui';
import * as THREE from 'three';

import gridFragmentShader from './grid.fs';
import gridVertexShader from './grid.vs';
import { Node as QuadTree, State } from './quad_tree';

export class Terrain extends THREE.Group {
  private lodRanges: number[] = [];
  private tree: QuadTree;
  private grid: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private fileLoader: THREE.FileLoader;
  private textureBuffer: Uint8Array;
  private textureIdx = 0;
  private maxTextures = 500;
  private lodLevels = 8;
  private worker: Worker;

  constructor(gui: GUI) {
    super();

    this.worker = new Worker('./src/core/worker.ts');
    this.worker.onmessage = (ev) => {
      const view = new Uint8Array(ev.data);
      console.log(view);
    };

    const sab = new SharedArrayBuffer(1024);
    this.worker.postMessage(sab);

    const tileSize = 128;

    const MAX_INSTANCES = 2000;

    this.tree = new QuadTree(0, 0, 4096, 0, 0);

    const minLodDistance = 128;
    for (let i = 0; i <= this.lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, 1 + this.lodLevels - i);
    }
    this.lodRanges[0] *= 8;
    console.log(this.lodRanges);

    const colors = ['#33f55f', '#befc26', '#e6c12f', '#fc8e26', '#f23424'].map((c) => new THREE.Color(c));

    //TODO: Generate normals for lighting

    //TODO: Create custom grid to fit new 256x256 data source (1/2 vertex on right and bottom for each quarter).
    // and generate it using the better pattern.
    const geometry = new THREE.PlaneGeometry(1, 1, tileSize - 1, tileSize - 1);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane

    const lodLevelAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
    geometry.setAttribute('lodLevel', lodLevelAttribute);

    const texIdAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
    geometry.setAttribute('texId', texIdAttribute);

    this.fileLoader = new THREE.FileLoader();
    this.fileLoader.setResponseType('arraybuffer');

    this.textureBuffer = new Uint8Array(4 * 256 * 256 * this.maxTextures);
    const atlas = new THREE.DataArrayTexture(this.textureBuffer, 256, 256, this.maxTextures);

    // node description buffer

    const shaderConfig = {
      uniforms: {
        sectorSize: { value: tileSize },
        lodRanges: { value: this.lodRanges },
        colors: { value: colors },
        enableLodColors: { value: false },
        atlas: { value: atlas },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      wireframe: true,
    };
    this.material = new THREE.ShaderMaterial(shaderConfig);

    // Create decorator around fileLoader -> tileLoader
    this.loadTile(this.fileLoader, 0, 0, this.textureBuffer);

    gui
      .add(shaderConfig, 'wireframe')
      .name('Wireframe')
      .onChange((visible: boolean) => (this.material.wireframe = visible));
    gui
      .add(shaderConfig.uniforms.enableLodColors, 'value')
      .name('LOD Colors')
      .onChange((enable: boolean) => (this.material.uniforms.enableLodColors.value = enable));

    this.grid = new THREE.InstancedMesh(geometry, this.material, MAX_INSTANCES);
    this.grid.count = 1;
    this.add(this.grid);
  }

  update(eye: THREE.Vector3, frustum: THREE.Frustum) {
    const lodLevelAttribute = this.grid.geometry.getAttribute('lodLevel') as THREE.InstancedBufferAttribute;
    const texIdAttribute = this.grid.geometry.getAttribute('texId') as THREE.InstancedBufferAttribute;

    const selectedNodes: { node: QuadTree; level: number; loadChildren: boolean }[] = [];
    this.tree.selectNodes(eye, [...this.lodRanges].reverse(), this.lodLevels, frustum, (node, level, loadChildren) => {
      selectedNodes.push({ node, level, loadChildren });

      if (loadChildren) {
        for (const child of node.children) {
          if (child.state !== State.empty) continue;
          child.state = State.isLoading;

          if (child.state === State.isLoading) {
            let tileSize = 8192;
            for (let i = 0; i < child.level; i++) tileSize /= 2;
            const tileX = Math.floor((child.x + 4096) / tileSize);
            const tileY = Math.floor((child.y + 4096) / tileSize);
            const tileIdx = calcZOrderCurveValue(tileX, tileY);

            this.loadTile(this.fileLoader, child.level, tileIdx, this.textureBuffer, (texIdx) => {
              child.state = State.loaded;
              child.texId = texIdx;
            });
          }
        }
      }
    });

    for (const [idx, obj] of selectedNodes.entries()) {
      this.grid.setMatrixAt(
        idx,
        new THREE.Matrix4().compose(
          new THREE.Vector3(obj.node.x, 0, obj.node.y),
          new THREE.Quaternion(),
          new THREE.Vector3(obj.node.halfSize * 2, 1, obj.node.halfSize * 2)
        )
      );

      lodLevelAttribute.set(Float32Array.from([obj.level]), idx);
      texIdAttribute.set(Float32Array.from([obj.node.texId]), idx);
    }

    lodLevelAttribute.needsUpdate = true;
    texIdAttribute.needsUpdate = true;
    this.grid.count = selectedNodes.length;
    this.grid.instanceMatrix.needsUpdate = true;
  }

  async loadTile(
    fileLoader: THREE.FileLoader,
    level: number,
    tileIdx: number,
    buffer: Uint8Array,
    cb?: (texId: number) => void
  ) {
    // TODO: Only increase textureIdx when tile successfully loaded.
    const texId = (await loadTileFromFile(
      fileLoader,
      level,
      tileIdx,
      buffer,
      this.textureIdx++ % this.maxTextures
    )) as number;
    this.material.uniforms.atlas.value.needsUpdate = true;
    if (cb) cb(texId);
  }
}

function loadTileFromFile(
  fileLoader: THREE.FileLoader,
  level: number,
  tileIdx: number,
  buffer: Uint8Array,
  texIdx: number = 0
) {
  return new Promise((resolve) => {
    const idxInHex = tileIdx.toString(16).toUpperCase().padStart(8, '0');
    fileLoader.load(`./src/assets/terrain/5${level}${idxInHex}.hght`, (data) => {
      const dataBuffer = new Uint8Array(data as ArrayBuffer);

      const size = 256 * 256;
      for (let i = 0; i < size; i++) {
        const stride = (texIdx * size + i) * 4;
        const height = ((((dataBuffer[i * 2 + 1] & 0xff) << 8) | (dataBuffer[i * 2] & 0xff)) / 65535) * 255;

        buffer[stride + 0] = height;
        buffer[stride + 1] = height;
        buffer[stride + 2] = height;
        buffer[stride + 3] = 255;
      }

      resolve(texIdx);
    });
  });
}

function calcZOrderCurveValue(x: number, y: number) {
  const MASKS = [0x55555555, 0x33333333, 0x0f0f0f0f, 0x00ff00ff];
  const SHIFTS = [1, 2, 4, 8];

  x = (x | (x << SHIFTS[3])) & MASKS[3];
  x = (x | (x << SHIFTS[2])) & MASKS[2];
  x = (x | (x << SHIFTS[1])) & MASKS[1];
  x = (x | (x << SHIFTS[0])) & MASKS[0];

  y = (y | (y << SHIFTS[3])) & MASKS[3];
  y = (y | (y << SHIFTS[2])) & MASKS[2];
  y = (y | (y << SHIFTS[1])) & MASKS[1];
  y = (y | (y << SHIFTS[0])) & MASKS[0];

  return x | (y << 1);
}
