import * as THREE from 'three';
// eslint-disable-next-line
// @ts-ignore
import { MapControls } from 'three/addons/controls/MapControls';

import { Raf } from './raf';
import { Scene } from './scene';
import { Stats } from './stats';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.y = 1800;
camera.position.x = 1100;

const controls = new MapControls(camera, renderer.domElement);
const scene = new Scene(camera);

controls.position0.set(-1000, 0, 0);

const stats = new Stats(renderer);
document.body.appendChild(stats.domElement);

window.addEventListener('resize', handleResize.bind(this), false);

Raf.add(render.bind(this));
Raf.pause = false;

function render(dt: number) {
  const startTime = performance.now();

  scene.update(dt);

  const endTime = performance.now() - startTime;

  stats.update(endTime);

  controls.update();
  renderer.render(scene, camera);
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
