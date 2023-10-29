import * as THREE from 'three';
import { randFloat, randInt } from 'three/src/math/MathUtils.js';

let textureIdx = 1;
const maxTextures = 500;

const fileLoader = new THREE.FileLoader();
fileLoader.setResponseType('arraybuffer');

self.addEventListener('message', async (ev) => {
  const result = [];

  for (const nodeData of ev.data) {
    const { level, x, y, buffer } = nodeData;

    let tileSize = 16384;
    for (let i = 0; i < level; i++) tileSize /= 2;

    const tileX = Math.floor((x + 8192) / tileSize);
    const tileY = Math.floor((y + 8192) / tileSize);
    const tileIdx = calcZOrderCurveValue(tileX, tileY);

    const { texId, minY, maxY } = await loadTileFromFile(
      fileLoader,
      level,
      tileIdx,
      buffer,
      textureIdx++ % maxTextures
    );
    result.push({ level, x, y, texId, minY, maxY });
  }

  self.postMessage(result);
});

function loadTileFromFile(
  fileLoader: THREE.FileLoader,
  level: number,
  tileIdx: number,
  buffer: Float32Array,
  texIdx: number = 0
): Promise<{ texId: number; minY: number; maxY: number }> {
  return new Promise((resolve) => {
    const idxInHex = tileIdx.toString(16).toUpperCase().padStart(8, '0');
    fileLoader.load(`../assets/terrain/5${level}${idxInHex}.hght`, (data) => {
      const dataBuffer = new Uint16Array(data as ArrayBuffer);

      let minY = 800;
      let maxY = 0;

      const size = 256 * 256;
      for (let i = 0; i < size; i++) {
        const stride = (texIdx * size + i) * 1;

        // Use red and greed channels to store 16 bit value. Convert to uint16 in shader.
        // buffer[stride + 0] = dataBuffer[i * 2];
        // buffer[stride + 1] = dataBuffer[i * 2 + 1];

        const height = (dataBuffer[i] / 65535.0) * 800;

        buffer[stride] = height;

        if (height > maxY) maxY = height;
        else if (height < minY) minY = height;
      }

      // console.log('Min Y: ', minY, 'Max y: ', maxY);

      resolve({ texId: texIdx, minY, maxY });
    });
  });
}

function calcZOrderCurveValue(x: number, y: number) {
  const MASKS = [0x55555555, 0x33333333, 0x0f0f0f0f, 0x00ff00ff];
  const SHIFTS = [1, 2, 4, 8];

  x = (x | (x << SHIFTS[3])) & MASKS[3];
  x = (x | (x << SHIFTS[2])) & MASKS[2];
  x = (x | (x << SHIFTS[1])) & MASKS[1];
  x = (x | (x << SHIFTS[0])) & MASKS[0];

  y = (y | (y << SHIFTS[3])) & MASKS[3];
  y = (y | (y << SHIFTS[2])) & MASKS[2];
  y = (y | (y << SHIFTS[1])) & MASKS[1];
  y = (y | (y << SHIFTS[0])) & MASKS[0];

  return x | (y << 1);
}
