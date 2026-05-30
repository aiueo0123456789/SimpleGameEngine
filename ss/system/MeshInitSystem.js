import { Mesh } from "../component/Mesh.js";
import { MeshRenderer } from "../component/MeshRenderer.js";
import { Engine } from "../core/Engine.js";
import { GPU } from "../utils/webGPU.js";

export class MeshInitSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  update() {
    /** @type {MeshRenderer[]} */
    const mrList = this.engine.scene.getComponents(MeshRenderer);
    for (const mr of mrList) {
      /** @type {Mesh} */
      const m = mr.gameObject.getComponent(Mesh);
      GPU.copyBuffer(m.gpu.verticesBuffer, mr.gpu.verticesBuffer);
      GPU.copyBuffer(m.gpu.normalsBuffer, mr.gpu.normalsBuffer);
      GPU.copyBuffer(m.gpu.tangentsBuffer, mr.gpu.tangentsBuffer);
    }
  }
}