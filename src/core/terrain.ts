import * as THREE from 'three';

import { Node as QuadTree } from './quad_tree';

export class Terrain extends THREE.Group {
  private lodRanges: number[] = [];
  private tree: QuadTree;

  constructor() {
    super();

    const segments = 128;

    //TODO: Create QuadTree/Node with center origin
    this.tree = new QuadTree(0, 0, 2048);
    this.tree.traverse((node) => {
      const mesh = generateQuadMesh(node.size, segments);
      mesh.position.x = node.x + node.size / 2 - 1024;
      mesh.position.z = node.y + node.size / 2 - 1024;
      mesh.visible = false;
      mesh.userData = node;
      this.add(mesh);
    });

    const minLodDistance = 128;
    const lodLevels = 4;
    for (let i = 0; i <= lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, lodLevels - i);
    }
  }

  update(eye: THREE.Vector3) {
    const selectedNodes: QuadTree[] = [];
    this.tree.selectNodes(eye, [...this.lodRanges].reverse(), 4, (node) => {
      selectedNodes.push(node);
    });

    for (const mesh of this.children) {
      mesh.visible = selectedNodes.includes(mesh.userData as QuadTree);

      for (const node of selectedNodes) {
        if (node === (mesh.userData as QuadTree)) {
          let color = 0x33f55f;
          if (node.level === 1) color = 0xbefc26;
          if (node.level === 2) color = 0xe6c12f;
          if (node.level === 3) color = 0xfc8e26;
          if (node.level === 4) color = 0xf23424;

          ((mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color);
        }
      }
    }
  }
}

function generateQuadMesh(size: number, segments: number) {
  const verts = [];
  const indices = [];
  const uvs = [];
  for (let y = 0; y < segments + 1; y++) {
    for (let x = 0; x < segments + 1; x++) {
      verts.push(-size / 2 + (x * size) / segments, 0, -size / 2 + (y * size) / segments);
      uvs.push(x / (segments + 1), 1 - y / (segments + 1)); // heightmap image size

      if (y > 0 && x > 0) {
        const prevrow = (y - 1) * (segments + 1);
        const thisrow = y * (segments + 1);

        if (Math.floor(y + x) % 2 === 0) {
          indices.push(thisrow + x);
          indices.push(prevrow + x);
          indices.push(prevrow + x - 1);

          indices.push(thisrow + x - 1);
          indices.push(thisrow + x);
          indices.push(prevrow + x - 1);
        } else {
          indices.push(thisrow + x - 1);
          indices.push(prevrow + x);
          indices.push(prevrow + x - 1);

          indices.push(thisrow + x - 1);
          indices.push(thisrow + x);
          indices.push(prevrow + x);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();

  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });

  return new THREE.Mesh(geometry, material);
}
