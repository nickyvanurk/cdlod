import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import { QuadTree } from './quad_tree';

export class Terrain extends Group {
  private tree: QuadTree;

  constructor() {
    super();
    this.rotateX(Math.PI / 2);

    this.tree = new QuadTree();

    const minLodDistance = 15;
    const lodLevels = 6;
    const lodRanges = [];

    for (let i = 0; i < lodLevels; i++) {
      lodRanges[i] = minLodDistance * Math.pow(2, lodLevels - 1 - i);
    }

    const geometry = new PlaneGeometry(2048, 2048, 128, 128);
    const material = new MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const plane = new Mesh(geometry, material);
    this.add(plane);

    console.log('New terrain');
  }
}
