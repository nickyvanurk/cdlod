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

    const tileSize = 128;

    const MAX_INSTANCES = 2000;

    this.tree = new QuadTree(0, 0, 4096, 0, 0);

    const minLodDistance = 128 * 6;
    const lodLevels = 4;
    for (let i = 0; i <= lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, 1 + lodLevels - i);
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

    const fileLoader = new THREE.FileLoader();
    fileLoader.setResponseType('arraybuffer');

    const depth = 100;
    const textureBuffer = new Uint8Array(4 * 256 * 256 * depth);
    const atlas = new THREE.DataArrayTexture(textureBuffer, 256, 256, depth);

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
    const material = new THREE.ShaderMaterial(shaderConfig);

    fileLoader.load('./src/assets/terrain/5000000000.hght', (data) => {
      const dataBuffer = new Uint8Array(data as ArrayBuffer);

      for (let i = 0; i < 256 * 256; i++) {
        const height = ((((dataBuffer[i * 2 + 1] & 0xff) << 8) | (dataBuffer[i * 2] & 0xff)) / 65535) * 255;
        const stride = i * 4;
        textureBuffer[stride] = height;
        textureBuffer[stride + 1] = height;
        textureBuffer[stride + 2] = height;
        textureBuffer[stride + 3] = 255;
      }

      material.uniforms.atlas.value.needsUpdate = true;
    });

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
    this.tree.selectNodes(eye, [...this.lodRanges].reverse(), 4, frustum, (node, level, loadChildren) => {
      selectedNodes.push({ node, level });

      if (loadChildren) {
        // console.log(node.children);
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
    }

    lodLevelAttribute.needsUpdate = true;
    this.grid.count = selectedNodes.length;
    this.grid.instanceMatrix.needsUpdate = true;
  }
}
