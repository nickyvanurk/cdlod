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

    const geometry = new PlaneGeometry(2048, 2048, 128, 128);
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
