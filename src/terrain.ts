import * as THREE from 'three';

import gridFragmentShader from './grid.fs';
import gridVertexShader from './grid.vs';
import { Node as QuadTree } from './quad_tree';

export class Terrain extends THREE.Group {
  material: THREE.ShaderMaterial;

  private lodRanges: number[] = [];
  private tree: QuadTree;
  private grid: THREE.InstancedMesh;

  private aabbHelpers = new THREE.Group();

  constructor(
    private heightData: Float32Array,
    texture: THREE.Texture
  ) {
    super();

    const MAX_INSTANCES = 500;

    this.tree = new QuadTree(0, 0, 2048);

    const minLodDistance = 256;
    const lodLevels = 4;
    for (let i = 0; i <= lodLevels; i++) {
      this.lodRanges[i] = minLodDistance * Math.pow(2, 1 + lodLevels - i);
    }

    const colors = ['#33f55f', '#befc26', '#e6c12f', '#fc8e26', '#f23424'].map((c) => new THREE.Color(c));

    const sectorSize = 64;
    const geometry = new THREE.PlaneGeometry(1, 1, sectorSize, sectorSize);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane

    const lodLevelAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
    geometry.setAttribute('lodLevel', lodLevelAttribute);

    const heightmap = new THREE.DataTexture(heightData, 4096, 4096, THREE.RedFormat, THREE.FloatType);
    heightmap.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sectorSize: { value: sectorSize },
        lodRanges: { value: this.lodRanges },
        colors: { value: colors },
        heightmap: { value: heightmap },
        albedomap: { value: texture },
        enableLodColors: { value: false },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      wireframe: false,
    });
    this.material = material;

    this.grid = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.grid.count = 1;
    this.add(this.grid);

    this.add(this.aabbHelpers);
    for (let i = 0; i < MAX_INSTANCES; i++) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const edges = new THREE.EdgesGeometry(geo);
      const aabb = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff0000 }));
      aabb.material.depthTest = false;
      aabb.visible = false;
      this.aabbHelpers.add(aabb);
    }
  }

  update(eye: THREE.Vector3, frustum: THREE.Frustum) {
    const lodLevelAttribute = this.grid.geometry.getAttribute('lodLevel') as THREE.InstancedBufferAttribute;

    for (const helper of this.aabbHelpers.children) {
      helper.visible = false;
    }

    const selectedNodes: { node: QuadTree; level: number }[] = [];
    this.tree.selectNodes(eye, [...this.lodRanges].reverse(), 4, frustum, (node, level) => {
      selectedNodes.push({ node, level });
    });

    for (const [idx, obj] of selectedNodes.entries()) {
      this.grid.setMatrixAt(
        idx,
        new THREE.Matrix4().compose(
          new THREE.Vector3(obj.node.x, 0, obj.node.y),
          new THREE.Quaternion(),
          new THREE.Vector3(obj.node.halfSize * 2, 1, obj.node.halfSize * 2)
        )
      );

      lodLevelAttribute.set(Float32Array.from([obj.level]), idx);

      const tileHeight = getTileHeight(this.heightData, 2047 + obj.node.x, 2047 - obj.node.y, obj.node.halfSize);
      const yPos = (tileHeight.min + tileHeight.max) / 2;
      const yScale = tileHeight.max - tileHeight.min;
      this.aabbHelpers.children[idx].position.set(obj.node.x, yPos, obj.node.y);
      this.aabbHelpers.children[idx].scale.set(obj.node.halfSize * 2, yScale, obj.node.halfSize * 2);
      this.aabbHelpers.children[idx].visible = true;
    }

    lodLevelAttribute.needsUpdate = true;
    this.grid.count = selectedNodes.length;
    this.grid.instanceMatrix.needsUpdate = true;
  }
}

function getTileHeight(data: Float32Array, x: number, y: number, halfWidth: number, halfHeight = halfWidth) {
  const width = 4096;
  const xHalf = halfWidth - 1;
  const yHalf = halfHeight - 1;
  const c1 = data[(y - yHalf) * width + (x - xHalf)];
  const c2 = data[(y - yHalf) * width + (x + xHalf)];
  const c3 = data[(y + yHalf) * width + (x - xHalf)];
  const c4 = data[(y + yHalf) * width + (x + xHalf)];
  const min = (Math.min(c1, c2, c3, c4) || 0) * 2600 - 700;
  const max = (Math.max(c1, c2, c3, c4) || 0) * 2600 - 700;
  return { min, max };
}
