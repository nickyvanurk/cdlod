import { QuadTree } from './quad_tree';

export class Terrain {
  private tree: QuadTree;

  constructor() {
    this.tree = new QuadTree();

    const minLodDistance = 15;
    const lodLevels = 6;
    const lodRanges = [];

    for (let i = 0; i < lodLevels; i++) {
      lodRanges[i] = minLodDistance * Math.pow(2, lodLevels - 1 - i);
    }

    console.log('New terrain');
  }
}
