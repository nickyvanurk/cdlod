import type GUI from 'lil-gui';
import * as THREE from 'three';

import gridFragmentShader from './grid.fs';
import gridVertexShader from './grid.vs';
import { Node as QuadTree } from './quad_tree';

export class Terrain extends THREE.Group {
  private lodRanges: number[] = [];
  private tree: QuadTree;
  private grid: THREE.InstancedMesh;

  constructor(gui: GUI) {
    super();

    const MAX_INSTANCES = 2000;

    this.tree = new QuadTree(0, 0, 1024);

    const minLodDistance = 128;
    const lodLevels = 4;
    for (let i = 0; i <= lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, 1 + lodLevels - i);
    }

    const colors = ['#33f55f', '#befc26', '#e6c12f', '#fc8e26', '#f23424'].map((c) => new THREE.Color(c));

    const sectorSize = 64;
    const geometry = new THREE.PlaneGeometry(1, 1, sectorSize, sectorSize);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane

    const lodLevelAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
    geometry.setAttribute('lodLevel', lodLevelAttribute);

    const width = 4096;
    const height = 4096;
    const size = width * height;
    const heightmap = new Float32Array(size);
    const heightmapDataTexture = new THREE.DataTexture(heightmap, width, height, THREE.RedFormat, THREE.FloatType);
    const loader = new THREE.FileLoader();
    loader.setResponseType('arraybuffer');
    loader.load('./src/heightmap.raw', (data) => {
      const buffer = new Uint16Array(data as ArrayBuffer);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const revIdx = (height - y - 1) * width + x;
          heightmap[y * width + x] = buffer[revIdx] / 65535;
        }
      }
      heightmapDataTexture.needsUpdate = true;
    });

    const textureLoader = new THREE.TextureLoader();

    const shaderConfig = {
      uniforms: {
        sectorSize: { value: sectorSize },
        lodRanges: { value: this.lodRanges },
        colors: { value: colors },
        heightmap: { value: heightmapDataTexture },
        albedomap: { value: textureLoader.load('./src/texture.png') },
        enableLodColors: { value: false },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      wireframe: false,
    };
    const material = new THREE.ShaderMaterial(shaderConfig);

    gui
      .add(shaderConfig, 'wireframe')
      .name('Wireframe')
      .onChange((visible: boolean) => (material.wireframe = visible));
    gui
      .add(shaderConfig.uniforms.enableLodColors, 'value')
      .name('LOD Colors')
      .onChange((enable: boolean) => (material.uniforms.enableLodColors.value = enable));

    this.grid = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.grid.count = 1;
    this.add(this.grid);
  }

  update(eye: THREE.Vector3, frustum: THREE.Frustum) {
    const lodLevelAttribute = this.grid.geometry.getAttribute('lodLevel') as THREE.InstancedBufferAttribute;

    const selectedNodes: { node: QuadTree; level: number }[] = [];
    this.tree.selectNodes(eye, [...this.lodRanges].reverse(), 4, frustum, (node, level) => {
      selectedNodes.push({ node, level });
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
    }

    lodLevelAttribute.needsUpdate = true;
    this.grid.count = selectedNodes.length;
    this.grid.instanceMatrix.needsUpdate = true;
  }
}
