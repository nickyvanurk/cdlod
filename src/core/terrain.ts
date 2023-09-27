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
  private maxTextures = 500; // TODO: shared with worker, refactor
  private lodLevels = 8;

  private worker: Worker;
  private textureBuffer: Uint8Array;

  constructor(gui: GUI) {
    super();

    this.worker = new Worker('./src/core/worker.ts', { type: 'module' });
    this.worker.onmessage = (ev) => {
      for (const nodeData of ev.data) {
        const { level, x, y, texId } = nodeData;

        this.tree.traverse((node) => {
          if (node.level === level && node.x === x && node.y === y) {
            node.texId = texId;
            node.state = State.loaded;
          }
        });
      }

      this.material.uniforms.atlas.value.needsUpdate = true;
    };

    const buffer = new SharedArrayBuffer(256 * 256 * 4 * this.maxTextures);
    this.textureBuffer = new Uint8Array(buffer);

    const tileSize = 128;

    const MAX_INSTANCES = 2000;

    this.tree = new QuadTree(0, 0, 4096, 0, 0);

    const minLodDistance = 32;
    for (let i = 0; i <= this.lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, 1 + this.lodLevels - i);
    }
    this.lodRanges[0] *= 2;
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

    this.worker.postMessage([{ level: 0, x: 0, y: 0, buffer: this.textureBuffer }]);

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
        const childrenToLoad = node.children.filter((n) => n.state === State.empty);
        childrenToLoad.forEach((n) => (n.state = State.isLoading));
        const tilesToLoad = childrenToLoad.map((n) => {
          return {
            level: n.level,
            x: n.x,
            y: n.y,
            buffer: this.textureBuffer,
          };
        });

        if (tilesToLoad.length > 0) this.worker.postMessage(tilesToLoad);
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
}
