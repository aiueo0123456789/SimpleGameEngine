import { Mesh } from "../component/Mesh.js";
import { MeshRenderer } from "../component/MeshRenderer.js";
import { Skinning } from "../component/Skinning.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";
import { loadFile } from "../utils/fileLoad.js";
import { GPU } from "../utils/webGPU.js";

const transformPipeline = GPU.device.createComputePipeline({
  layout: "auto",
  compute: {
    module: GPU.createShaderModule(
      await loadFile("./ss/assets/shader/compute/transform.wgsl"),
    ),
    entryPoint: "main",
  },
});

export class MeshTransformSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  update() {
    /** @type {Transform[]} */
    const transformComponents = this.engine.scene.getComponents(Transform);
    for (const transformComponent of transformComponents) {
      if (transformComponent.gameObject.getComponent(Skinning)) continue;
      /** @type {Mesh} */
      const m = transformComponent.gameObject.getComponent(Mesh);
      if (!m) continue;
      /** @type {MeshRenderer} */
      const mr = transformComponent.gameObject.getComponent(MeshRenderer);
      if (!mr) continue;
      const modelMatrixBuffer = GPU.createBuffer(
        4 * 4 * 4,
        ["u"],
        transformComponent.getWorldMatrix(),
      );

      const group = GPU.createGroup(transformPipeline.getBindGroupLayout(0), [
        modelMatrixBuffer,
        mr.gpu.verticesBuffer,
        mr.gpu.normalsBuffer,
        mr.gpu.tangentsBuffer,
      ]);

      const computeCommandEncoder = GPU.device.createCommandEncoder();
      const computePassEncoder = computeCommandEncoder.beginComputePass();
      computePassEncoder.setPipeline(transformPipeline);
      computePassEncoder.setBindGroup(0, group);
      computePassEncoder.dispatchWorkgroups(
        Math.ceil(m.verticesNum / 64),
        1,
        1,
      ); // ワークグループ数をディスパッチ
      computePassEncoder.end();
      GPU.device.queue.submit([computeCommandEncoder.finish()]);
    }
  }
}
