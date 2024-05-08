import * as THREE from 'three';

export class Node {
  subTL: Node | null = null;
  subTR: Node | null = null;
  subBL: Node | null = null;
  subBR: Node | null = null;
  aabb = new THREE.Box3();
  min = 0;
  max = 0;

  constructor(
    public x: number,
    public y: number,
    public halfSize: number,
    public level = 0
  ) {
    if (level < 5) {
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

  selectNodes(
    eye: THREE.Vector3,
    ranges: number[],
    level: number,
    frustum: THREE.Frustum,
    cb: (node: Node, level: number) => void
  ) {
    // check biggest range first, is this correct?
    if (!this.aabb.intersectsSphere(new THREE.Sphere(eye, ranges[level]))) {
      // no node or child nodes were selected; return false so that our parent node handles our area.
      return false;
    }

    if (!frustum.intersectsBox(this.aabb)) {
      // we are out of frustum, select nothing but return true to mark this node as having been
      // correctly handled so that our parent node does not select itself over our area.
      return true;
    }

    if (level === 0) {
      // we are at the most detailed level
      // four 1/2 resolution nodes form one whole node. it's needed for when when we need to
      // only add a part of a node.
      if (this.subTL && this.subTR && this.subBL && this.subBR) {
        cb(this.subTL, this.level);
        cb(this.subTR, this.level);
        cb(this.subBL, this.level);
        cb(this.subBR, this.level);
      }
      return true;
    } else {
      if (!this.aabb.intersectsSphere(new THREE.Sphere(eye, ranges[level - 1]))) {
        if (this.subTL && this.subTR && this.subBL && this.subBR) {
          cb(this.subTL, this.level);
          cb(this.subTR, this.level);
          cb(this.subBL, this.level);
          cb(this.subBR, this.level);
        }
      } else {
        // add only a part of the node. again, children can be either part of this node or
        // a child node, depending on the level. all nodes are 1/2 resolution. so the root
        // node exists as four 1/2 resolution nodes, the same goes for all other nodes.
        if (this.subTL !== null && !this.subTL.selectNodes(eye, ranges, level - 1, frustum, cb)) {
          cb(this.subTL, this.level);
        }

        if (this.subTR !== null && !this.subTR.selectNodes(eye, ranges, level - 1, frustum, cb)) {
          cb(this.subTR, this.level);
        }

        if (this.subBL !== null && !this.subBL.selectNodes(eye, ranges, level - 1, frustum, cb)) {
          cb(this.subBL, this.level);
        }

        if (this.subBR !== null && !this.subBR.selectNodes(eye, ranges, level - 1, frustum, cb)) {
          cb(this.subBR, this.level);
        }
      }
    }

    return true;
  }
}
