import * as THREE from 'three';
// eslint-disable-next-line
// @ts-ignore
import { MapControls } from 'three/addons/controls/MapControls';
// eslint-disable-next-line
// @ts-ignore
import type Stats from 'three/examples/jsm/libs/stats.module';

import { Raf } from '@core/raf';
import { Scene } from '@core/scene';

import { RenderStats } from '@ui/render_stats';

export class World {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: MapControls;

  private scene: Scene;

  private renderStats: Stats;

  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.y = 1500;
    this.camera.lookAt(new THREE.Vector3());

    this.controls = new MapControls(this.camera, this.renderer.domElement);

    this.scene = new Scene(this.camera);

    this.renderStats = new RenderStats(this.renderer);
    document.body.appendChild(this.renderStats.domElement);

    window.addEventListener('resize', this.handleResize.bind(this), false);

    Raf.add(this.render.bind(this));
    Raf.pause = false;
  }

  render(dt: number) {
    const startTime = performance.now();

    this.scene.update(dt);

    const endTime = performance.now() - startTime;

    this.renderStats.update(endTime);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
