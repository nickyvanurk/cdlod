import * as THREE from 'three';

// import gridVertexShader from './grid.vs';
import { Terrain } from '@core/terrain';

export class Scene extends THREE.Scene {
  private terrain = new Terrain();

  constructor(private camera: THREE.PerspectiveCamera) {
    super();

    this.add(this.terrain);

    // const sectorSize = 64;
    // const geometry = new THREE.PlaneGeometry(2048, 2048, sectorSize * 2, sectorSize * 2);
    // geometry.rotateX(-Math.PI / 2); // flip to xz plane

    // const material = new THREE.ShaderMaterial({
    //   uniforms: {
    //     sectorSize: { value: sectorSize },
    //   },
    //   vertexShader: gridVertexShader,
    //   wireframe: true,
    // });

    // const grid = new THREE.InstancedMesh(geometry, material, 1);
    // this.add(grid);
  }

  update(_dt: number) {
    this.terrain.update(this.camera.position);
  }
}
