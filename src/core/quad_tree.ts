import * as THREE from 'three';

export enum State {
  empty,
  isLoading,
  loaded,
}

export class Node {
  children: Node[] = [];
  texId = 0;
  minY = 0;
  maxY = 0;

  constructor(
    public x: number,
    public y: number,
    public halfSize: number,
    public level = 0,
    public state = State.empty
  ) { }

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
    cb: (node: Node, level: number, loadChildren: boolean) => void
  ) {
    const aabb = new THREE.Box3(
      new THREE.Vector3(this.x - this.halfSize, this.minY, this.y - this.halfSize),
      new THREE.Vector3(this.x + this.halfSize, this.maxY, this.y + this.halfSize)
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
      cb(this, this.level, false);
      return true;
    } else {
      // if node lies completely in the smaller range
      if (!aabb.intersectsSphere(new THREE.Sphere(eye, ranges[level - 1]))) {
        cb(this, this.level, false);
      } else {
        if (this.children.length === 0) {
          const subSize = this.halfSize / 2;
          this.children.push(new Node(this.x - subSize, this.y - subSize, subSize, this.level + 1));
          this.children.push(new Node(this.x + subSize, this.y - subSize, subSize, this.level + 1));
          this.children.push(new Node(this.x - subSize, this.y + subSize, subSize, this.level + 1));
          this.children.push(new Node(this.x + subSize, this.y + subSize, subSize, this.level + 1));
        }

        let allChildrenLoaded = true;
        for (const child of this.children) {
          if (!(child.state === State.loaded)) {
            allChildrenLoaded = false;
            break;
          }
        }

        if (allChildrenLoaded) {
          for (const child of this.children) {
            if (!child.selectNodes(eye, ranges, level - 1, frustum, cb)) {
              cb(child, child.level, false);
            }
          }
        } else {
          cb(this, this.level, true);
        }
      }
    }

    return true;
  }
}
