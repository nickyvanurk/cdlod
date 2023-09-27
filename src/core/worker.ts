importScripts('./three.js');

let textureIdx = 1;
const maxTextures = 500;

const fileLoader = new THREE.FileLoader();
fileLoader.setResponseType('arraybuffer');

self.addEventListener('message', async (ev) => {
  const result = [];

  for (const nodeData of ev.data) {
    const { level, x, y, buffer } = nodeData;

    let tileSize = 8192;
    for (let i = 0; i < level; i++) tileSize /= 2;

    const tileX = Math.floor((x + 4096) / tileSize);
    const tileY = Math.floor((y + 4096) / tileSize);
    const tileIdx = calcZOrderCurveValue(tileX, tileY);

    const texId = (await loadTileFromFile(fileLoader, level, tileIdx, buffer, textureIdx++ % maxTextures)) as number;
    result.push({ level, x, y, texId });
  }

  self.postMessage(result);
});

function loadTileFromFile(
  fileLoader: THREE.FileLoader,
  level: number,
  tileIdx: number,
  buffer: Uint8Array,
  texIdx: number = 0
) {
  return new Promise((resolve) => {
    const idxInHex = tileIdx.toString(16).toUpperCase().padStart(8, '0');
    fileLoader.load(`../assets/terrain/5${level}${idxInHex}.hght`, (data) => {
      const dataBuffer = new Uint8Array(data as ArrayBuffer);

      const size = 256 * 256;
      for (let i = 0; i < size; i++) {
        const stride = (texIdx * size + i) * 4;
        const height = ((((dataBuffer[i * 2 + 1] & 0xff) << 8) | (dataBuffer[i * 2] & 0xff)) / 65535) * 255;

        buffer[stride + 0] = height;
        buffer[stride + 1] = height;
        buffer[stride + 2] = height;
        buffer[stride + 3] = 255;
      }

      resolve(texIdx);
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
