import { vec4 } from "../../../../webgpuMatrix.js";
import { flatFloat32Array } from "../../../utils/util.js";
import { GPU } from "../../../utils/webGPU.js";

class GPUDataManager {
  constructor() {
    this.verticesBuffer = null;
    this.colorBuffer = null;
  }

  /**
   *
   * @param {Gizmo_Triangle} gt
   */
  update(gt) {
    this.verticesBuffer = GPU.createBuffer(
      gt.vertices.length * 4 * 4,
      ["v"],
      flatFloat32Array(gt.vertices),
    );
    this.colorBuffer = GPU.createBuffer(gt.color.byteLength, ["u"], gt.color);
  }
}

export class Gizmo_Triangle {
  constructor() {
    this.type == "TRIANGLE";
    /** @type {[Float32Array, Float32Array, Float32Array]} */
    this.vertices = [vec4.create(), vec4.create(), vec4.create()];
    /** @type {Float32Array} */
    this.color = vec4.create();

    this.gpu = new GPUDataManager();
  }

  setVertices(vertices) {
    for (let vi = 0; vi < 3; vi++) {
      vec4.copy(vertices[vi], this.vertices[vi]);
    }
    this.update();
  }

  setColor(color) {
    vec4.copy(color, this.color);
    this.update();
  }

  update() {
    this.gpu.update(this);
  }
}
