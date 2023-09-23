import * as THREE from 'three';

import { Terrain } from '@core/terrain';

export class Scene extends THREE.Scene {
  private terrain = new Terrain();
  private frustum = new THREE.Frustum();
  private mat4 = new THREE.Matrix4();

  constructor(private camera: THREE.PerspectiveCamera) {
    super();

    this.add(this.terrain);
  }

  update(_dt: number) {
    this.frustum.setFromProjectionMatrix(
      this.mat4.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
    );
    this.terrain.update(this.camera.position, this.frustum);
  }
}
