import GUI from 'lil-gui';
import * as THREE from 'three';
// eslint-disable-next-line
// @ts-ignore
import { MapControls } from 'three/addons/controls/MapControls';

import { Raf } from './raf';
import { Stats } from './stats';
import { Terrain } from './terrain';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.y = 1800;
camera.position.x = 1100;

const controls = new MapControls(camera, renderer.domElement);

const stats = new Stats(renderer);
document.body.appendChild(stats.domElement);

window.addEventListener('resize', handleResize.bind(this), false);

Raf.add(render.bind(this));
Raf.pause = false;

const gui = new GUI();

const terrain = new Terrain(gui);
const scene = new THREE.Scene();
scene.add(terrain);

const frustum = new THREE.Frustum();
const mat4 = new THREE.Matrix4();

function render() {
  const startTime = performance.now();

  frustum.setFromProjectionMatrix(mat4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  terrain.update(camera.position, frustum);

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
