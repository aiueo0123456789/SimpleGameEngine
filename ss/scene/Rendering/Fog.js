import { GPU } from "../../utils/webGPU.js";

class GPUDataManager {
  constructor() {
    `
    struct Fog {
      color: vec3<f32>,
      colorPadding: f32,
      start: f32,
      end: f32,
      padding: vec2<f32>,
    }
    `;
    this.colorOffset = 0;
    this.colorPaddingOffset = this.colorOffset + 3 * 4;
    this.startOffset = this.colorPaddingOffset + 4;
    this.endOffset = this.startOffset + 4;
    this.paddingOffset = this.endOffset + 4;
    this.bufferSize = this.paddingOffset + 2 * 4;
    this.fogBuffer = GPU.createBuffer(this.bufferSize, ["u"]);
  }

  update(/** @type {Fog} */ fog) {
    GPU.writeBuffer(
      this.fogBuffer,
      GPU.createBitData(fog.color, ["f32"]),
      this.colorOffset,
    );
    GPU.writeBuffer(
      this.fogBuffer,
      GPU.createBitData([fog.start], ["f32"]),
      this.startOffset,
    );
    GPU.writeBuffer(
      this.fogBuffer,
      GPU.createBitData([fog.end], ["f32"]),
      this.endOffset,
    );
  }
}

export class Fog {
  constructor() {
    this.color = [0, 0, 0];
    this.start = 0;
    this.end = 0;

    this.gpu = new GPUDataManager();
  }

  setColor(color) {
    this.color[0] = color[0];
    this.color[1] = color[1];
    this.color[2] = color[2];
    this.gpuUpdate();
  }

  setStart(start) {
    this.start = start;
    this.gpuUpdate();
  }

  setEnd(end) {
    this.end = end;
    this.gpuUpdate();
  }

  gpuUpdate() {
    this.gpu.update(this);
  }
}
