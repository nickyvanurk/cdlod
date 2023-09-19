import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor(_camera: THREE.PerspectiveCamera) {
    super();

    const maxLod = 5;
    const sectorSize = 64;
    const maxScale = sectorSize * Math.pow(2, maxLod);
    const geometry = new THREE.PlaneGeometry(maxScale, maxScale, sectorSize * 2, sectorSize * 2);
    geometry.rotateX(-Math.PI / 2); // flip to xz plane
    console.log(sectorSize * Math.pow(2, maxLod));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sectorSize: { value: sectorSize },
      },
      wireframe: true,
    });

    const grid = new THREE.InstancedMesh(geometry, material, 1);
    this.add(grid);
  }

  update(_dt: number) {}
}
