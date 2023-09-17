export class Node {
  subTL: Node | null = null;
  subTR: Node | null = null;
  subBL: Node | null = null;
  subBR: Node | null = null;

  constructor(
    public x: number,
    public y: number,
    public size: number,
    public level = 0
  ) {
    if (level < 2) {
      const subSize = size / 2;
      this.subTL = new Node(x, y, subSize, level + 1);
      this.subTR = new Node(x + subSize, y, subSize, level + 1);
      this.subBL = new Node(x, y + subSize, subSize, level + 1);
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
}
