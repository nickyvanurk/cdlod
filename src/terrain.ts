import * as THREE from 'three';

import gridFragmentShader from './grid.fs';
import gridVertexShader from './grid.vs';
import { Node as QuadTree } from './quad_tree';

export class Terrain extends THREE.Group {
  material: THREE.ShaderMaterial;

  private lodRanges: number[] = [];
  private tree: QuadTree;
  private grid: THREE.InstancedMesh;

  constructor() {
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

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sectorSize: { value: sectorSize },
        lodRanges: { value: this.lodRanges },
        colors: { value: colors },
        heightmap: { value: loadHeightmap('./src/heightmap.raw') },
        albedomap: { value: loadTexture('./src/texture.png') },
        enableLodColors: { value: false },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      wireframe: false,
    });
    this.material = material;

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

function loadHeightmap(src: string, width = 4096, height = 4096) {
  const size = width * height;
  const buffer = new Float32Array(size);
  const dataTex = new THREE.DataTexture(buffer, width, height, THREE.RedFormat, THREE.FloatType);
  const fileLoader = new THREE.FileLoader();
  fileLoader.setResponseType('arraybuffer');
  fileLoader.load(src, (data) => {
    const srcBuffer = new Uint16Array(data as ArrayBuffer);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const revIdx = (height - y - 1) * width + x;
        buffer[y * width + x] = srcBuffer[revIdx] / 65535;
      }
    }
    dataTex.needsUpdate = true;
  });
  return dataTex;
}

function loadTexture(src: string) {
  const textureLoader = new THREE.TextureLoader();
  return textureLoader.load(src);
}
