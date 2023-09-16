import * as THREE from 'three';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import { QuadTree } from './quad_tree';

export class Terrain extends Group {
  private tree: QuadTree;

  constructor() {
    super();
    this.rotateX(-Math.PI / 2);

    this.tree = new QuadTree();

    const minLodDistance = 15;
    const lodLevels = 6;
    const lodRanges = [];

    for (let i = 0; i < lodLevels; i++) {
      lodRanges[i] = minLodDistance * Math.pow(2, lodLevels - 1 - i);
    }

    const tileSize = 2048;
    const segments = 128;

    const verts = [];
    const indices = [];
    const uvs = [];
    for (let y = 0; y < segments + 1; y++) {
      for (let x = 0; x < segments + 1; x++) {
        verts.push(-tileSize / 2 + (x * tileSize) / segments, -tileSize / 2 + (y * tileSize) / segments, 0);
        uvs.push(x / (segments + 1), y / (segments + 1));

        if (y > 0 && x > 0) {
          const prevrow = (y - 1) * (segments + 1);
          const thisrow = y * (segments + 1);

          if (Math.floor(y + x) % 2 === 0) {
            indices.push(prevrow + x - 1);
            indices.push(prevrow + x);
            indices.push(thisrow + x);
            indices.push(prevrow + x - 1);
            indices.push(thisrow + x);
            indices.push(thisrow + x - 1);
          } else {
            indices.push(prevrow + x - 1);
            indices.push(prevrow + x);
            indices.push(thisrow + x - 1);
            indices.push(prevrow + x);
            indices.push(thisrow + x);
            indices.push(thisrow + x - 1);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const material = new MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const plane = new Mesh(geometry, material);
    this.add(plane);

    const heightmapUrl =
      'https://service.pdok.nl/rws/ahn/wms/v1_0?SERVICE=WMS&request=GetMap&version=1.3.0&Layers=dtm_05m&styles=default&crs=EPSG:28992&bbox=-285401.92,22598.08,595401.92,903401.92&width=129&height=129&format=image/jpeg';
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'Anonymous';
    textureLoader.load(heightmapUrl, (tex) => {
      plane.material.map = tex;
      plane.material.needsUpdate = true;

      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      const ctx = canvas!.getContext('2d')!;
      canvas.width = 129;
      canvas.height = 129;
      ctx.drawImage(tex.source.data, 0, 0);

      for (let y = 0; y < 129; y++) {
        const v = [];
        for (let x = 0; x < 129; x++) {
          const pixel = ctx.getImageData(x, y, 1, 1).data; // rgba
          if (pixel[0] !== 255 || pixel[1] !== 255 || pixel[2] !== 255) {
            v.push(pixel);
          }
        }
        console.log(v);
      }
    });

    console.log('New terrain');
  }
}
