import * as THREE from 'three';

export class Node {
  subTL: Node | null = null;
  subTR: Node | null = null;
  subBL: Node | null = null;
  subBR: Node | null = null;

  constructor(
    public x: number,
    public y: number,
    public halfSize: number,
    public level = 0
  ) {
    if (level < 4) {
      const subSize = halfSize / 2;
      this.subTL = new Node(x - subSize, y - subSize, subSize, level + 1);
      this.subTR = new Node(x + subSize, y - subSize, subSize, level + 1);
      this.subBL = new Node(x - subSize, y + subSize, subSize, level + 1);
      this.subBR = new Node(x + subSize, y + subSize, subSize, level + 1);
    }
  }

  traverse(cb: (node: Node) => void) {
    cb(this);

    this.subTL?.traverse(cb);
    this.subTR?.traverse(cb);
    this.subBL?.traverse(cb);
    this.subBR?.traverse(cb);
  }

  selectNodes(eye: THREE.Vector3, ranges: number[], level: number, cb: (node: Node) => void) {
    const aabb = new THREE.Box3(
      new THREE.Vector3(this.x - this.halfSize, 0, this.y - this.halfSize),
      new THREE.Vector3(this.x + this.halfSize, 0, this.y + this.halfSize)
    );

    // check biggest range first, is this correct?
    if (!aabb.intersectsSphere(new THREE.Sphere(eye, ranges[level]))) {
      // no node or child nodes were selected; return false so that our parent node handles our area.
      return false;
    }

    if (level === 0) {
      // we are at the most detailed level
      cb(this);
      return true;
    } else {
      if (!aabb.intersectsSphere(new THREE.Sphere(eye, ranges[level - 1]))) {
        cb(this);
      } else {
        if (this.subTL !== null && !this.subTL.selectNodes(eye, ranges, level - 1, cb)) {
          this.subTL.level--;
          cb(this.subTL);
          this.subTL.level++;
        }

        if (this.subTR !== null && !this.subTR.selectNodes(eye, ranges, level - 1, cb)) {
          this.subTR.level--;
          cb(this.subTR);
          this.subTR.level++;
        }

        if (this.subBL !== null && !this.subBL.selectNodes(eye, ranges, level - 1, cb)) {
          this.subBL.level--;
          cb(this.subBL);
          this.subBL.level++;
        }

        if (this.subBR !== null && !this.subBR.selectNodes(eye, ranges, level - 1, cb)) {
          this.subBR.level--;
          cb(this.subBR);
          this.subBR.level++;
        }
      }
    }

    return true;
  }
}
