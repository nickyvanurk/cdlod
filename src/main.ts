import GUI from 'lil-gui';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls';

import { Node as QuadTree } from './quad_tree';
import { Stats } from './stats';
import terrainFs from './terrain.fs';
import terrainVs from './terrain.vs';

const heightData = await loadHeightmap('./src/heightmap.raw');
const texture = await loadTexture('./src/texture.png');

let activeCamera: THREE.PerspectiveCamera;
let mainCamera: THREE.PerspectiveCamera;
let debugCamera: THREE.PerspectiveCamera;
let mainCameraHelper: THREE.CameraHelper;
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let controls: MapControls;
let stats: Stats;
let tree: QuadTree;
let lodRanges: number[];
let aabbHelpers: THREE.Group;
let grid: THREE.InstancedMesh;

const frustum = new THREE.Frustum();
const mat4 = new THREE.Matrix4();

init();
animate();

function init() {
  const maxTerrainHeight = 2600;

  scene = new THREE.Scene();

  mainCamera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
  mainCamera.position.y = 1800;
  mainCamera.position.x = 1100;

  debugCamera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
  debugCamera.position.y = 1800;
  debugCamera.position.x = 1100;

  activeCamera = mainCamera;

  mainCameraHelper = new THREE.CameraHelper(mainCamera);
  mainCameraHelper.visible = false;
  scene.add(mainCameraHelper);

  tree = new QuadTree(0, 0, 2048);

  tree.traverse((node) => {
    const tileHeight = getTileHeight(heightData, 2047 + node.x, 2047 - node.y, node.halfSize);
    node.min = tileHeight.min;
    node.max = tileHeight.max;
    node.aabb.set(
      new THREE.Vector3(node.x - node.halfSize, tileHeight.min, node.y - node.halfSize),
      new THREE.Vector3(node.x + node.halfSize, tileHeight.max, node.y + node.halfSize)
    );
  });

  function getTileHeight(data: Float32Array, x: number, y: number, halfWidth: number, halfHeight = halfWidth) {
    const width = 4096;
    const xHalf = halfWidth - 1;
    const yHalf = halfHeight - 1;
    const c1 = data[(y - yHalf) * width + (x - xHalf)];
    const c2 = data[(y - yHalf) * width + (x + xHalf)];
    const c3 = data[(y + yHalf) * width + (x - xHalf)];
    const c4 = data[(y + yHalf) * width + (x + xHalf)];
    const min = (Math.min(c1, c2, c3, c4) || 0) * maxTerrainHeight;
    const max = (Math.max(c1, c2, c3, c4) || 0) * maxTerrainHeight;
    return { min, max };
  }

  const minLodDistance = 256;
  const lodLevels = 4;
  lodRanges = [] as number[];
  for (let i = 0; i <= lodLevels; i++) {
    lodRanges[i] = minLodDistance * Math.pow(2, 1 + lodLevels - i);
  }

  const colors = [
    '#33f55f' /* green */,
    '#befc26' /* lime */,
    '#e6c12f' /* yellow */,
    '#fc8e26' /* orange */,
    '#f23424' /* red */,
  ].map((c) => new THREE.Color(c));

  const sectorSize = 64;
  const geometry = new THREE.PlaneGeometry(1, 1, sectorSize, sectorSize);
  geometry.rotateX(-Math.PI / 2); // flip to xz plane

  const MAX_INSTANCES = 500;

  const lodLevelAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
  geometry.setAttribute('lodLevel', lodLevelAttribute);

  const heightmap = new THREE.DataTexture(heightData, 4096, 4096, THREE.RedFormat, THREE.FloatType);
  heightmap.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      sectorSize: { value: sectorSize },
      lodRanges: { value: lodRanges },
      colors: { value: colors },
      heightmap: { value: heightmap },
      albedomap: { value: texture },
      enableLodColors: { value: false },
      cameraPos: { value: mainCamera.position },
      maxTerrainHeight: { value: maxTerrainHeight },
    },
    vertexShader: terrainVs,
    fragmentShader: terrainFs,
    wireframe: false,
  });

  grid = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
  grid.frustumCulled = false;
  grid.count = 1;
  scene.add(grid);

  aabbHelpers = new THREE.Group();
  aabbHelpers.visible = false;
  scene.add(aabbHelpers);
  for (let i = 0; i < MAX_INSTANCES; i++) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geo);
    const aabb = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff0000 }));
    aabb.material.depthTest = false;
    aabb.visible = false;
    aabbHelpers.add(aabb);
  }

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new MapControls(activeCamera, renderer.domElement);

  stats = new Stats(renderer);
  document.body.appendChild(stats.domElement);

  const gui = new GUI();
  gui
    .add(material, 'wireframe')
    .name('Wireframe')
    .onChange((visible: boolean) => (material.wireframe = visible));
  gui
    .add(material.uniforms.enableLodColors, 'value')
    .name('LOD Colors')
    .onChange((enable: boolean) => (material.uniforms.enableLodColors.value = enable));
  gui
    .add(aabbHelpers, 'visible')
    .name('AABB')
    .onChange((visible: boolean) => (aabbHelpers.visible = visible));
  gui
    .add(material.uniforms.maxTerrainHeight, 'value', 0, 5000)
    .name('Max Height')
    .onChange((value: number) =>
      tree.traverse((node) => {
        node.aabb.min.y = node.min * (value / maxTerrainHeight);
        node.aabb.max.y = node.max * (value / maxTerrainHeight);
      })
    );

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);
}

function onWindowResize() {
  activeCamera.aspect = window.innerWidth / window.innerHeight;
  activeCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case '1':
      activeCamera = mainCamera;
      controls.object = activeCamera;
      mainCameraHelper.visible = false;
      break;
    case '2':
      activeCamera = debugCamera;
      controls.object = activeCamera;
      mainCameraHelper.visible = true;
      break;
  }
}

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  stats.begin();
  render();
  stats.end();
}

function render() {
  frustum.setFromProjectionMatrix(mat4.multiplyMatrices(mainCamera.projectionMatrix, mainCamera.matrixWorldInverse));

  const lodLevelAttribute = grid.geometry.getAttribute('lodLevel') as THREE.InstancedBufferAttribute;

  if (aabbHelpers.visible) {
    for (const helper of aabbHelpers.children) {
      helper.visible = false;
    }
  }

  const selectedNodes: { node: QuadTree; level: number }[] = [];
  tree.selectNodes(mainCamera.position, [...lodRanges].reverse(), 4, frustum, (node, level) => {
    selectedNodes.push({ node, level });
  });

  for (const [idx, obj] of selectedNodes.entries()) {
    grid.setMatrixAt(
      idx,
      new THREE.Matrix4().compose(
        new THREE.Vector3(obj.node.x, 0, obj.node.y),
        new THREE.Quaternion(),
        new THREE.Vector3(obj.node.halfSize * 2, 1, obj.node.halfSize * 2)
      )
    );

    lodLevelAttribute.set(Float32Array.from([obj.level]), idx);

    if (aabbHelpers.visible) {
      const yPos = (obj.node.aabb.min.y + obj.node.aabb.max.y) * 0.5;
      const yScale = obj.node.aabb.max.y - obj.node.aabb.min.y;
      aabbHelpers.children[idx].position.set(obj.node.x, yPos, obj.node.y);
      aabbHelpers.children[idx].scale.set(obj.node.halfSize * 2, yScale, obj.node.halfSize * 2);
      aabbHelpers.children[idx].visible = true;
    }
  }

  lodLevelAttribute.needsUpdate = true;
  grid.count = selectedNodes.length;
  grid.instanceMatrix.needsUpdate = true;

  renderer.render(scene, activeCamera);
}

async function loadHeightmap(src: string, width = 4096, height = 4096) {
  const size = width * height;
  const buffer = new Float32Array(size);
  const fileLoader = new THREE.FileLoader();
  fileLoader.setResponseType('arraybuffer');
  const data = (await fileLoader.loadAsync(src)) as ArrayBuffer;
  const srcBuffer = new Uint16Array(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const revIdx = (height - y - 1) * width + x;
      buffer[y * width + x] = srcBuffer[revIdx] / 65535;
    }
  }
  return buffer;
}

async function loadTexture(src: string) {
  const textureLoader = new THREE.TextureLoader();
  return await textureLoader.loadAsync(src);
}
