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

    this.tree = new QuadTree(0, 0, 4096);

    const minLodDistance = 128;
    const lodLevels = 4;
    for (let i = 0; i <= lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, 1 + lodLevels - i);
    }
    this.lodRanges[0] *= 8;
    console.log(this.lodRanges);

    const colors = ['#33f55f', '#befc26', '#e6c12f', '#fc8e26', '#f23424'].map((c) => new THREE.Color(c));

    //TODO: Generate normals for lighting

    const sectorSize = 128;
    //TODO: Create custom grid to fit new 256x256 data source (1/2 vertex on right and bottom for each quarter).
    // and generate it using the better pattern.
    const geometry = new THREE.PlaneGeometry(1, 1, 128, 128);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane

    const lodLevelAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
    geometry.setAttribute('lodLevel', lodLevelAttribute);

    const fileLoader = new THREE.FileLoader();
    fileLoader.setResponseType('arraybuffer');

    const atlas: THREE.DataTexture = new THREE.DataTexture(
      new Uint8Array(4 * 256 * 256),
      512,
      512,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );

    // node description buffer

    const shaderConfig = {
      uniforms: {
        sectorSize: { value: sectorSize },
        lodRanges: { value: this.lodRanges },
        colors: { value: colors },
        enableLodColors: { value: false },
        atlas: { value: atlas },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      wireframe: false,
    };
    const material = new THREE.ShaderMaterial(shaderConfig);

    fileLoader.load('./src/assets/terrain/5000000000.hght', (data) => {
      const view = new Uint8Array(data as ArrayBuffer);

      const resolution = 256 * 256;
      const buffer = new Uint8Array(4 * resolution);

      for (let i = 0; i < resolution; i++) {
        const height = ((((view[i * 2 + 1] & 0xff) << 8) | (view[i * 2] & 0xff)) / 65535) * 255;
        const stride = i * 4;
        buffer[stride] = height;
        buffer[stride + 1] = height;
        buffer[stride + 2] = height;
        buffer[stride + 3] = 255;
      }

      const texture = new THREE.DataTexture(buffer, 256, 256, THREE.RGBAFormat, THREE.UnsignedByteType);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;

      material.uniforms.atlas.value.dispose();
      material.uniforms.atlas.value = texture;
      material.needsUpdate = true;
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
