// Skia's official Jest environment uses ESM; this CJS adapter keeps Jest 29.
const { TestEnvironment } = require('jest-environment-node');
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit');

module.exports = class SkiaEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    this.global.CanvasKit = await CanvasKitInit({});
  }
};
