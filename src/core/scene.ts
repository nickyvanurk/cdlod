import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls';

import '@ui/style.css';

import { Terrain } from './terrain';

export class Scene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: MapControls;

  private cube: THREE.Mesh;
  private terrain: Terrain;

  constructor() {
    this.renderer = new THREE.WebGLRenderer();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.camera.position.y = 1500;
    this.camera.lookAt(new THREE.Vector3());

    this.controls = new MapControls(this.camera, this.renderer.domElement);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    this.terrain = new Terrain();
    this.scene.add(this.terrain);

    window.addEventListener('resize', this.handleResize.bind(this), false);
  }

  render() {
    requestAnimationFrame(this.render.bind(this));

    this.cube.rotation.x += 0.01;
    this.cube.rotation.y += 0.01;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
