import GUI from 'lil-gui';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls';

import { Node as QuadTree } from './quad_tree';
import { Stats } from './stats';
import terrainFs from './terrain.fs';
import terrainVs from './terrain.vs';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.y = 1800;
camera.position.x = 1100;

const controls = new MapControls(camera, renderer.domElement);

const scene = new THREE.Scene();

const heightData = await loadHeightmap('./src/heightmap.raw');
const texture = await loadTexture('./src/texture.png');

const frustum = new THREE.Frustum();
const mat4 = new THREE.Matrix4();

const MAX_INSTANCES = 500;

const tree = new QuadTree(0, 0, 2048, 0, heightData);

const minLodDistance = 256;
const lodLevels = 4;
const lodRanges = [] as number[];
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
  },
  vertexShader: terrainVs,
  fragmentShader: terrainFs,
  wireframe: false,
});

const grid = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
grid.frustumCulled = false;
grid.count = 1;
scene.add(grid);

const aabbHelpers = new THREE.Group();
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

const stats = new Stats(renderer);
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

requestAnimationFrame(render);

function render() {
  requestAnimationFrame(render);

  const startTime = performance.now();

  frustum.setFromProjectionMatrix(mat4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

  const lodLevelAttribute = grid.geometry.getAttribute('lodLevel') as THREE.InstancedBufferAttribute;

  if (aabbHelpers.visible) {
    for (const helper of aabbHelpers.children) {
      helper.visible = false;
    }
  }

  const selectedNodes: { node: QuadTree; level: number }[] = [];
  tree.selectNodes(camera.position, [...lodRanges].reverse(), 4, frustum, (node, level) => {
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
      const yPos = (obj.node.min + obj.node.max) * 0.5;
      const yScale = obj.node.max - obj.node.min;
      aabbHelpers.children[idx].position.set(obj.node.x, yPos, obj.node.y);
      aabbHelpers.children[idx].scale.set(obj.node.halfSize * 2, yScale, obj.node.halfSize * 2);
      aabbHelpers.children[idx].visible = true;
    }
  }

  lodLevelAttribute.needsUpdate = true;
  grid.count = selectedNodes.length;
  grid.instanceMatrix.needsUpdate = true;

  const endTime = performance.now() - startTime;

  stats.update(endTime);

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', handleResize.bind(this), false);

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
