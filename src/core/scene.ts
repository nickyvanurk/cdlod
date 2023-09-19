import * as THREE from 'three';

import gridVertexShader from './grid.vs';

export class Scene extends THREE.Scene {
  constructor(_camera: THREE.PerspectiveCamera) {
    super();

    const sectorSize = 64;
    const geometry = new THREE.PlaneGeometry(2048, 2048, sectorSize * 2, sectorSize * 2);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sectorSize: { value: sectorSize },
      },
      vertexShader: gridVertexShader,
      wireframe: true,
    });

    const grid = new THREE.InstancedMesh(geometry, material, 1);
    this.add(grid);
  }

  update(_dt: number) {}
}
