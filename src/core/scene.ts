import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor(private camera: THREE.PerspectiveCamera) {
    super();
  }

  update(_dt: number) {}
}
