import GUI from 'lil-gui';
import * as THREE from 'three';

import { Terrain } from '@core/terrain';

export class Scene extends THREE.Scene {
  private terrain: Terrain;
  private frustum = new THREE.Frustum();
  private mat4 = new THREE.Matrix4();

  constructor(private camera: THREE.PerspectiveCamera) {
    super();

    const gui = new GUI();

    this.terrain = new Terrain(gui);
    this.add(this.terrain);
  }

  update(_dt: number) {
    this.frustum.setFromProjectionMatrix(
      this.mat4.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
    );
    this.terrain.update(this.camera.position, this.frustum);
  }
}
