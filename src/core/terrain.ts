import { QuadTree } from './quad_tree';

export class Terrain {
  private tree: QuadTree;

  constructor() {
    this.tree = new QuadTree();

    console.log('New terrain');
  }
}
