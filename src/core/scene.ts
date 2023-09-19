import * as THREE from 'three';

import { Terrain } from '@core/terrain';

export class Scene extends THREE.Scene {
  private terrain = new Terrain();

  constructor(private camera: THREE.PerspectiveCamera) {
    super();

    this.add(this.terrain);
  }

  update(_dt: number) {
    this.terrain.update(this.camera.position);
  }
}
