import * as THREE from 'three';

import { Node as QuadTree } from './quad_tree';

export class Terrain extends THREE.Group {
  constructor() {
    super();
    this.rotateX(-Math.PI / 2);

    const tree = new QuadTree(0, 0, 2048);
    tree.traverse((node) => {
      console.log(node);
    });

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
        uvs.push(x / (segments + 1), y / (segments + 1)); // heightmap image size

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

    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const plane = new THREE.Mesh(geometry, material);
    this.add(plane);

    const bbox = [-285401.92, 22598.08, 595401.92, 903401.9];
    const width = bbox[2] - bbox[0];
    const height = bbox[3] - bbox[1];
    const center = [150000, 450000]; // todo...zoom in on center
    const zoom = 1;

    for (let i = 0; i < bbox.length; i++) {
      bbox[i] /= zoom;
    }

    if (zoom > 1) {
      const halfWidth = width / 3 / 2;
      bbox[0] += halfWidth;
      bbox[2] += halfWidth;

      const halfHeight = height / 1 / 2;
      bbox[1] += halfHeight;
      bbox[3] += halfHeight;
    }

    const heightmapUrl = `https://service.pdok.nl/rws/ahn/wms/v1_0?SERVICE=WMS&request=GetMap&version=1.3.0&Layers=dtm_05m&styles=default&crs=EPSG:28992&bbox=${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}&width=129&height=129&format=image/jpeg`;
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'Anonymous';
    textureLoader.load(heightmapUrl, (tex) => {
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;

      plane.material.map = tex;
      plane.material.needsUpdate = true;

      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      const ctx = canvas!.getContext('2d')!;
      canvas.width = segments + 1;
      canvas.height = segments + 1;
      ctx.drawImage(tex.source.data, 0, 0);

      const colors = [];
      for (let y = 0; y < segments + 1; y++) {
        for (let x = 0; x < segments + 1; x++) {
          const pixel = ctx.getImageData(x, y, 1, 1).data; // rgba
          if (pixel[0] !== 255 || pixel[1] !== 255 || pixel[2] !== 255) {
            const scale = 50;
            const heightFactor = 1 - pixel[2] / 255;
            const height = heightFactor * scale;

            if (heightFactor > 0) {
              const idx = (segments - y) * (segments + 1) * 3 + x * 3;
              plane.geometry.attributes.position.array[idx + 2] = height;
            }

            colors.push(pixel[0], pixel[1], pixel[2]);
          } else {
            colors.push(255, 0, 0);
          }
        }
      }

      plane.geometry.attributes.position.needsUpdate = true;
    });

    console.log('New terrain');
  }
}
