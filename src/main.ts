import GUI from 'lil-gui';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls';

import { Node as QuadTree } from './quad_tree';
import { Stats } from './stats';
import terrainFs from './terrain.fs';
import terrainVs from './terrain.vs';
import { TerrainBounds } from './terrain_bounds';

/**
 * Terrain extent in world units (1 unit = 1 metre), so 16km x 16km. The single knob:
 * quadtree depth, LOD ranges, camera, fog and far plane all derive from it below.
 *
 * Nothing about startup scales with this. The terrain is an analytic field evaluated in the
 * shader (terrain_common.glsl) with no heightmap anywhere, so there is no generation step
 * to pay for at any map size.
 */
const MAP_SIZE = 16384;

/** Peak altitude. At MAP_SIZE 16384 this is a height:width ratio of ~0.16, roughly alpine. */
const maxTerrainHeight = 2600;

/**
 * Waterline, as a fraction of the height range. Feeds the `seaLevel` uniform.
 *
 * Not the same quantity as SHORE in terrain_common.glsl, despite the similar look: SHORE is
 * a threshold on the continent *mask*, this is a *height*. They are independent knobs.
 */
const SEA_LEVEL = 0.32;

/**
 * Quadtree depth, and with it the number of LOD levels. Each level halves node size, so the
 * finest node is MAP_SIZE / 2^LOD_LEVELS across. At 16km and 8 levels that is a 64-unit
 * node, which at sectorSize 64 gives ~1 unit per vertex up close.
 */
const LOD_LEVELS = 8;

/** Vertices per node edge. */
const sectorSize = 64;

/**
 * Resolution of the CPU-side height grid used only for quadtree AABBs.
 *
 * Has to out-resolve the quadtree: the finest node is MAP_SIZE / 2^LOD_LEVELS across, and a
 * node narrower than a couple of samples cannot be bounded from this grid at all -- its box
 * degenerates to its neighbourhood's, plus margin. At 16km and 8 levels the leaf is 64m, so
 * 2048 (8m per sample) puts eight samples across it.
 *
 * bounds.fs packs height into RGBA8 rather than a float target, which is what keeps a grid
 * this fine affordable: 16MB to read back instead of 64MB.
 */
const BOUNDS_SIZE = 2048;

/**
 * AABB padding, as a fraction of the height range.
 *
 * Covers relief the grid cannot see *between* samples, so it is a property of the sample
 * spacing, not of the world. Summing each noise octave's contribution over a half-sample step
 * comes to ~12m at this spacing; this is ~2x that.
 *
 * It applies to every node equally, so it sets a floor on how tall any box can be, which is
 * why it cannot simply be made generous: at 6% (156m per side) every box was at least 312m
 * tall, and the 64m leaves rendered as 5:1 columns stacked through each other.
 */
const BOUNDS_MARGIN = 0.01;

/** How far above the ground the camera opens. */
const CAMERA_HEIGHT = 420;

/** Minimum gap kept between the camera and the ground when a new seed rebuilds under it. */
const CAMERA_CLEARANCE = 60;

/** Seed the demo opens on. Any integer is a different world. */
const INITIAL_SEED = 1337;

/** Distance at which ground detail textures fade out to the flat band colour. */
const DETAIL_FADE = 900;

/** World size of one ground-texture tile, in metres. */
const DETAIL_TILE = 4;

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
let material: THREE.ShaderMaterial;
let bounds: TerrainBounds;

const frustum = new THREE.Frustum();
const mat4 = new THREE.Matrix4();

init();
animate();

function init() {
  scene = new THREE.Scene();

  // Far plane has to clear the map diagonal, or distant terrain -- the thing CDLOD exists
  // to draw -- gets clipped away.
  const farPlane = MAP_SIZE * 2;

  mainCamera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 1, farPlane);
  // Position is set once the bounds probe can tell us where the ground is.

  debugCamera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 1, farPlane);

  activeCamera = mainCamera;

  mainCameraHelper = new THREE.CameraHelper(mainCamera);
  mainCameraHelper.visible = false;
  scene.add(mainCameraHelper);

  tree = new QuadTree(0, 0, MAP_SIZE / 2, LOD_LEVELS);

  // Each level doubles its range, so the ranges cover the whole map with the finest band
  // hugging the camera. lodRanges[0] is the outermost.
  const minLodDistance = 192;
  lodRanges = [] as number[];
  for (let i = 0; i < LOD_LEVELS; i++) {
    lodRanges[i] = minLodDistance * Math.pow(2, LOD_LEVELS - i);
  }

  const colors = rampColors(LOD_LEVELS);

  const geometry = new THREE.PlaneGeometry(1, 1, sectorSize, sectorSize);
  geometry.rotateX(-Math.PI / 2); // flip to xz plane

  const MAX_INSTANCES = 4000;

  const lodLevelAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES), 1, false, 1);
  geometry.setAttribute('lodLevel', lodLevelAttribute);

  // Shared with the bounds probe so both evaluate the identical field.
  const terrainUniforms: Record<string, THREE.IUniform> = {
    maxTerrainHeight: { value: maxTerrainHeight },
    mapSize: { value: MAP_SIZE },
    seaLevel: { value: SEA_LEVEL },
    seedOffset: { value: seedToOffset(INITIAL_SEED) },
  };

  const fogColor = new THREE.Color('#9fb6c6');
  // Tuned so the far side of the map is nearly fully hazed: that gradient is what makes
  // 16km read as 16km rather than as a nearby ridge.
  const fogDensity = 1.1 / MAP_SIZE;

  material = new THREE.ShaderMaterial({
    uniforms: {
      ...terrainUniforms,
      sectorSize: { value: sectorSize },
      lodRanges: { value: lodRanges },
      colors: { value: colors },
      enableLodColors: { value: false },
      cameraPos: { value: mainCamera.position },
      fogColor: { value: fogColor },
      fogDensity: { value: fogDensity },
      groundGrass: { value: tiledTexture('ground_grass') },
      groundDirt: { value: tiledTexture('ground_dirt') },
      groundRock: { value: tiledTexture('ground_rock') },
      detailTile: { value: DETAIL_TILE },
      detailFade: { value: DETAIL_FADE },
    },
    defines: { LOD_LEVELS },
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
  // One geometry and one material shared across every helper; building them per instance
  // costs real time at this instance count and they are all identical unit cubes anyway.
  const aabbEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  const aabbMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, depthTest: false });
  for (let i = 0; i < MAX_INSTANCES; i++) {
    const aabb = new THREE.LineSegments(aabbEdges, aabbMaterial);
    aabb.visible = false;
    aabbHelpers.add(aabb);
  }

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor('#9fb6c6');
  document.body.appendChild(renderer.domElement);

  // Bounds need the renderer, and the quadtree AABBs need the bounds, so both come after
  // the context exists.
  bounds = new TerrainBounds(BOUNDS_SIZE, MAP_SIZE, terrainUniforms);
  bounds.update(renderer);
  updateNodeBounds(tree, maxTerrainHeight);

  // Open on the lowlands looking at the range, rather than straight down from altitude:
  // the terrain's own silhouette receding into haze is what carries the sense of distance.
  const eye = findOpeningView();
  mainCamera.position.copy(eye);
  debugCamera.position.copy(eye);

  controls = new MapControls(activeCamera, renderer.domElement);
  controls.target.set(eye.x - 2600, eye.y - 520, eye.z - 2600);
  controls.update();

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
    .onChange((value: number) => applyTerrainHeight(tree, value));
  gui
    .add({ debugCamera: false }, 'debugCamera')
    .name('Debug Camera')
    .onChange((enable: boolean) => activateCamera(enable ? '2' : '1'));

  const terrainFolder = gui.addFolder('Terrain');
  const terrainParams = {
    seed: INITIAL_SEED,
    regenerate: () => {
      // Roll a new seed. Regenerating the *same* seed reproduces the same world down to the
      // metre -- the field is a pure function of it -- so a button that reused the current
      // seed looked broken: it did a full rebuild and the screen did not change.
      terrainParams.seed = Math.floor(Math.random() * 100000);
      seedController.updateDisplay();
      regenerate(terrainParams.seed);
    },
  };
  // Typing a seed applies it immediately; the button is for when you do not care which.
  const seedController = terrainFolder
    .add(terrainParams, 'seed')
    .name('Seed')
    .step(1)
    .onFinishChange((value: number) => regenerate(value));
  terrainFolder.add(terrainParams, 'regenerate').name('Random Seed');

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;

  // Both, not just the active one. Culling always builds its frustum from mainCamera, so
  // resizing while the debug camera is active would otherwise leave the terrain culled to
  // the old aspect -- and switching back would render stretched until the next resize.
  for (const camera of [mainCamera, debugCamera]) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  mainCameraHelper.update();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === '1' || event.key === '2') {
    activateCamera(event.key);
  }
}

function activateCamera(cameraId: string) {
  switch (cameraId) {
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
  // matrixWorldInverse is only refreshed inside renderer.render(), which runs at the end of
  // this function -- and controls.update() calls lookAt(), which sets the quaternion but not
  // the matrix. Without this the frustum below is a frame behind the camera while cameraPos
  // is current, so culling and LOD disagree and nodes entering from the screen edge get
  // discarded for a frame while rotating.
  mainCamera.updateMatrixWorld();

  frustum.setFromProjectionMatrix(mat4.multiplyMatrices(mainCamera.projectionMatrix, mainCamera.matrixWorldInverse));

  const lodLevelAttribute = grid.geometry.getAttribute('lodLevel') as THREE.InstancedBufferAttribute;

  if (aabbHelpers.visible) {
    for (const helper of aabbHelpers.children) {
      helper.visible = false;
    }
  }

  const selectedNodes: { node: QuadTree; level: number }[] = [];
  tree.selectNodes(mainCamera.position, [...lodRanges].reverse(), LOD_LEVELS - 1, frustum, (node, level) => {
    selectedNodes.push({ node, level });
  });

  if (selectedNodes.length > grid.instanceMatrix.count) {
    console.warn(
      `CDLOD selected ${selectedNodes.length} nodes, over the ${grid.instanceMatrix.count} instance cap; dropping the excess.`
    );
    selectedNodes.length = grid.instanceMatrix.count;
  }

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

/**
 * Normalized min/max per node, bottom-up: leaves scan their span of the bounds grid,
 * parents reduce their children. Sampling only the four corners (as this did when fed
 * smooth satellite data) clips peaks that fall between them, so ridges pop in and out of
 * view.
 */
function computeNodeBounds(node: QuadTree) {
  const children = [node.subTL, node.subTR, node.subBL, node.subBR].filter((c): c is QuadTree => c !== null);

  let min = Infinity;
  let max = -Infinity;

  if (children.length > 0) {
    for (const child of children) {
      computeNodeBounds(child);
      min = Math.min(min, child.min);
      max = Math.max(max, child.max);
    }
  } else {
    const a = bounds.gridFromWorld(node.x - node.halfSize, node.y - node.halfSize);
    const b = bounds.gridFromWorld(node.x + node.halfSize, node.y + node.halfSize);

    // Every sample the node's span touches, and no more. Widening by an extra sample on each
    // side sounds free but is not: it is a fixed number of *metres*, so on the finest nodes it
    // doubles the ground the box has to cover and drags in neighbouring relief. Terrain
    // between the node edge and the nearest sample is what BOUNDS_MARGIN is for.
    const x0 = Math.floor(Math.min(a.fx, b.fx));
    const x1 = Math.ceil(Math.max(a.fx, b.fx));
    const y0 = Math.floor(Math.min(a.fy, b.fy));
    const y1 = Math.ceil(Math.max(a.fy, b.fy));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const h = bounds.at(x, y);
        if (h < min) min = h;
        if (h > max) max = h;
      }
    }
  }

  node.min = min === Infinity ? 0 : min;
  node.max = max === -Infinity ? 0 : max;
}

/**
 * Rescale AABBs from cached normalized bounds. Cheap enough to run per slider tick.
 *
 * Padded by BOUNDS_MARGIN because the bounds grid samples every ~32m and the real field is
 * continuous: a summit between two samples is invisible to the scan. Without the pad the
 * boxes are too tight and real peaks get culled while still on screen.
 */
function applyTerrainHeight(node: QuadTree, terrainHeight: number) {
  const margin = terrainHeight * BOUNDS_MARGIN;
  node.traverse((n) => {
    // Write the corners in place. The tree is ~87k nodes at 8 levels, and this runs on every
    // tick of the Max Height slider; allocating two Vector3 per node here is ~175k throwaway
    // objects per drag.
    n.aabb.min.set(n.x - n.halfSize, n.min * terrainHeight - margin, n.y - n.halfSize);
    n.aabb.max.set(n.x + n.halfSize, n.max * terrainHeight + margin, n.y + n.halfSize);
  });
}

/**
 * Pick a camera spot on open lowland, rather than hardcoding coordinates that land in a lake
 * the moment the seed changes.
 *
 * Searches the bounds grid for low ground near the centre of the map: the belt of lowland
 * runs diagonally, and standing in the middle of it puts the range to the north-west with
 * open distance behind it -- which is the view that shows what CDLOD is doing.
 */
function findOpeningView() {
  const wanted = SEA_LEVEL + 0.1 * (1 - SEA_LEVEL);

  let best: { x: number; z: number; score: number } | null = null;
  for (let ty = 2; ty < BOUNDS_SIZE - 2; ty += 2) {
    for (let tx = 2; tx < BOUNDS_SIZE - 2; tx += 2) {
      // Require land along both axes through the sample, or the camera opens on a sandbar in
      // the shallows. A plus, not a box -- the corners go unchecked, which is enough here.
      let ok = true;
      for (let d = -2; d <= 2 && ok; d++) {
        if (bounds.at(tx, ty + d) < SEA_LEVEL + 0.02) ok = false;
        if (bounds.at(tx + d, ty) < SEA_LEVEL + 0.02) ok = false;
      }
      if (!ok) continue;

      const { x, z } = bounds.worldFromGrid(tx, ty);
      const score = Math.abs(bounds.at(tx, ty) - wanted) * 12 + Math.hypot(x, z) / MAP_SIZE;
      if (!best || score < best.score) best = { x, z, score };
    }
  }

  const x = best?.x ?? 0;
  const z = best?.z ?? 0;
  const y = bounds.sampleMax(x, z) * maxTerrainHeight + CAMERA_HEIGHT;
  return new THREE.Vector3(x, y, z);
}

/** A repeating ground detail texture. */
function tiledTexture(name: string) {
  const t = new THREE.TextureLoader().load(`./textures/${name}.png`);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Seeds the field by translating its noise domain; any offset gives a different world. */
function seedToOffset(seed: number) {
  const rand = (n: number) => {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return (x - Math.floor(x)) * 200 - 100;
  };
  return new THREE.Vector2(rand(1), rand(2));
}

/** Green -> red ramp across the LOD levels, coarsest first. */
function rampColors(levels: number) {
  return Array.from({ length: levels }, (_, i) => new THREE.Color().setHSL((1 - i / (levels - 1)) * 0.33, 0.85, 0.55));
}

function updateNodeBounds(node: QuadTree, terrainHeight: number) {
  computeNodeBounds(node);
  applyTerrainHeight(node, terrainHeight);
}

/**
 * There is no terrain to generate: the field is analytic, so a new world is just a new
 * noise-domain offset. Only the culling bounds need recomputing, which is one small
 * render plus a readback.
 */
function regenerate(seed: number) {
  material.uniforms.seedOffset.value.copy(seedToOffset(seed));
  bounds.update(renderer);
  updateNodeBounds(tree, material.uniforms.maxTerrainHeight.value);

  // The new world is built underneath a camera that has not moved, so the ground it was
  // standing on may now be a mountainside. Inside the terrain, front faces cull away and the
  // view collapses to slivers of whatever is beyond -- which reads as "regenerate broke it".
  // Lift clear if that happened, but never push down: the camera keeps whatever height the
  // user flew to.
  const floorY = bounds.sampleMax(mainCamera.position.x, mainCamera.position.z) * maxTerrainHeight;
  const minY = floorY + CAMERA_CLEARANCE;
  if (mainCamera.position.y < minY) {
    const lift = minY - mainCamera.position.y;
    mainCamera.position.y += lift;
    controls.target.y += lift;
    controls.update();
  }
}
