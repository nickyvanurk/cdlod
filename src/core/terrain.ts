import * as THREE from 'three';

import gridVertexShader from './grid.vs';
import { Node as QuadTree } from './quad_tree';

export class Terrain extends THREE.Group {
  private lodRanges: number[] = [];
  private tree: QuadTree;
  private grid: THREE.InstancedMesh;

  constructor() {
    super();

    this.tree = new QuadTree(0, 0, 1024);

    const minLodDistance = 128;
    const lodLevels = 4;
    for (let i = 0; i <= lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, lodLevels - i);
    }

    const sectorSize = 64;
    const geometry = new THREE.PlaneGeometry(1, 1, sectorSize * 2, sectorSize * 2);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sectorSize: { value: sectorSize },
      },
      vertexShader: gridVertexShader,
      wireframe: true,
    });

    this.grid = new THREE.InstancedMesh(geometry, material, 200);
    this.grid.count = 1;
    this.add(this.grid);
  }

  update(eye: THREE.Vector3) {
    const selectedNodes: QuadTree[] = [];
    this.tree.selectNodes(eye, [...this.lodRanges].reverse(), 4, (node) => {
      selectedNodes.push(node);
    });

    for (const [idx, node] of selectedNodes.entries()) {
      this.grid.setMatrixAt(
        idx,
        new THREE.Matrix4().compose(
          new THREE.Vector3(node.x, 0, node.y),
          new THREE.Quaternion(),
          new THREE.Vector3(node.halfSize * 2, 1, node.halfSize * 2)
        )
      );
    }

    this.grid.count = selectedNodes.length;
    this.grid.instanceMatrix.needsUpdate = true;

    // for (const mesh of this.children) {
    //   mesh.visible = selectedNodes.includes(mesh.userData as QuadTree);
    //   for (const node of selectedNodes) {
    //     if (node === (mesh.userData as QuadTree)) {
    //       let color = 0x33f55f;
    //       if (node.level === 1) color = 0xbefc26;
    //       if (node.level === 2) color = 0xe6c12f;
    //       if (node.level === 3) color = 0xfc8e26;
    //       if (node.level === 4) color = 0xf23424;
    //       ((mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color);
    //     }
    //   }
    // }
  }
}
