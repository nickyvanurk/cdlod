import * as THREE from 'three';

import gridFragmentShader from './grid.fs';
import gridVertexShader from './grid.vs';
import { Node as QuadTree } from './quad_tree';

export class Terrain extends THREE.Group {
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
      this.lodRanges[i] = minLodDistance * Math.pow(2, lodLevels - i);
    }

    const colors = ['#33f55f', '#befc26', '#e6c12f', '#fc8e26', '#f23424'].map((c) => new THREE.Color(c));

    const sectorSize = 64;
    const geometry = new THREE.PlaneGeometry(1, 1, sectorSize * 2, sectorSize * 2);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane

    const lodLevelAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
    geometry.setAttribute('lodLevel', lodLevelAttribute);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sectorSize: { value: sectorSize },
        colors: { value: colors },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      wireframe: true,
    });

    this.grid = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.grid.count = 1;
    this.add(this.grid);
  }

  update(eye: THREE.Vector3) {
    const selectedNodes: QuadTree[] = [];
    this.tree.selectNodes(eye, [...this.lodRanges].reverse(), 4, (node) => {
      selectedNodes.push(node);
    });

    const lodLevelAttribute = this.grid.geometry.getAttribute('lodLevel') as THREE.InstancedBufferAttribute;

    for (const [idx, node] of selectedNodes.entries()) {
      this.grid.setMatrixAt(
        idx,
        new THREE.Matrix4().compose(
          new THREE.Vector3(node.x, 0, node.y),
          new THREE.Quaternion(),
          new THREE.Vector3(node.halfSize * 2, 1, node.halfSize * 2)
        )
      );

      lodLevelAttribute.set(Float32Array.from([node.level]), idx);
    }

    lodLevelAttribute.needsUpdate = true;
    this.grid.count = selectedNodes.length;
    this.grid.instanceMatrix.needsUpdate = true;
  }
}
