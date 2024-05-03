import * as THREE from 'three';
// eslint-disable-next-line
// @ts-ignore
import { MapControls } from 'three/addons/controls/MapControls';

import { Raf } from './raf';
import { Scene } from './scene';
import { Stats } from './stats';

export class World {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: MapControls;
  private scene: Scene;
  private stats: Stats;

  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.y = 1500;
    this.camera.lookAt(new THREE.Vector3());

    this.controls = new MapControls(this.camera, this.renderer.domElement);

    this.scene = new Scene(this.camera);

    this.stats = new Stats(this.renderer);
    document.body.appendChild(this.stats.domElement);

    window.addEventListener('resize', this.handleResize.bind(this), false);

    Raf.add(this.render.bind(this));
    Raf.pause = false;
  }

  render(dt: number) {
    const startTime = performance.now();

    this.scene.update(dt);

    const endTime = performance.now() - startTime;

    this.stats.update(endTime);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
