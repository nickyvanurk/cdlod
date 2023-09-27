import * as THREE from 'three';

export class Node {
  children: Node[] = [];

  constructor(
    public x: number,
    public y: number,
    public halfSize: number,
    public level = 0,
    public loaded = false
  ) {}

  traverse(cb: (node: Node) => void) {
    cb(this);

    for (const child of this.children) {
      child.traverse(cb);
    }
  }

  selectNodes(
    eye: THREE.Vector3,
    ranges: number[],
    level: number,
    frustum: THREE.Frustum,
    cb: (node: Node, level: number) => void
  ) {
    const aabb = new THREE.Box3(
      new THREE.Vector3(this.x - this.halfSize, 0, this.y - this.halfSize),
      new THREE.Vector3(this.x + this.halfSize, 0, this.y + this.halfSize)
    );

    // check biggest range first, is this correct?
    if (!aabb.intersectsSphere(new THREE.Sphere(eye, ranges[level]))) {
      // no node or child nodes were selected; return false so that our parent node handles our area.
      return false;
    }

    if (!frustum.intersectsBox(aabb)) {
      // we are out of frustum, select nothing but return true to mark this node as having been
      // correctly handled so that our parent node does not select itself over our area.
      return true;
    }

    // if most detailed
    if (level === 0) {
      cb(this, this.level);
      return true;
    } else {
      // if node lies completely in the smaller range
      if (!aabb.intersectsSphere(new THREE.Sphere(eye, ranges[level - 1]))) {
        cb(this, this.level);
      } else {
        if (this.children.length === 0) {
          const subSize = this.halfSize / 2;
          this.children.push(new Node(this.x - subSize, this.y - subSize, subSize, this.level + 1));
          this.children.push(new Node(this.x + subSize, this.y - subSize, subSize, this.level + 1));
          this.children.push(new Node(this.x - subSize, this.y + subSize, subSize, this.level + 1));
          this.children.push(new Node(this.x + subSize, this.y + subSize, subSize, this.level + 1));
        }

        for (const child of this.children) {
          if (!child.selectNodes(eye, ranges, level - 1, frustum, cb)) {
            cb(child, child.level);
          }
        }
      }
    }

    return true;
  }
}
