import * as THREE from 'three';

import { Terrain } from './terrain';

export class Scene extends THREE.Scene {
  private terrain: Terrain;

  constructor(private camera: THREE.PerspectiveCamera) {
    super();

    this.terrain = new Terrain();
    this.add(this.terrain);
  }

  update(_dt: number) {
    this.terrain.update(this.camera.position);
  }
}
