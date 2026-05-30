import { Mesh } from "../component/Mesh.js";
import { MeshRenderer } from "../component/MeshRenderer.js";
import { Skinning } from "../component/Skinning.js";
import { Engine } from "../core/Engine.js";
import { loadFile } from "../utils/fileLoad.js";
import { GPU } from "../utils/webGPU.js";

const skinningPipeline = GPU.device.createComputePipeline({
  layout: "auto",
  compute: {
    module: GPU.createShaderModule(
      await loadFile("./ss/assets/shader/compute/skinning.wgsl"),
    ),
    entryPoint: "main",
  },
});

export class SkinningSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  update() {
    /** @type {Skinning[]} */
    const skinningTargets = this.engine.scene.getComponents(Skinning);
    for (const skinningTarget of skinningTargets) {
      const bones = skinningTarget.armature.bones;
      const boneCount = bones.length;
      const posesBoneMatrices = new Float32Array(boneCount * 16);

      for (let i = 0; i < boneCount; i++) {
        posesBoneMatrices.set(bones[i].getWorldMatrix(), i * 16);
        // console.log(bones[i].getWorldMatrix(), bones[i].name);
      }
      const posesMatricesBuffer = GPU.createBuffer(
        bones.length * 16 * 4,
        ["s"],
        posesBoneMatrices,
      );

      /** @type {Mesh} */
      const m = skinningTarget.gameObject.getComponent(Mesh);
      const bindPoses = new Float32Array(m.bindPoses.flat());
      const bindPosesMatricesBuffer = GPU.createBuffer(
        bones.length * 16 * 4,
        ["s"],
        bindPoses,
      );
      /** @type {MeshRenderer} */
      const mr = skinningTarget.gameObject.getComponent(MeshRenderer);

      const group = GPU.createGroup(skinningPipeline.getBindGroupLayout(0), [
        bindPosesMatricesBuffer,
        posesMatricesBuffer,
        m.gpu.skinIndexsBuffer,
        m.gpu.skinWeightsBuffer,
        mr.gpu.verticesBuffer,
        mr.gpu.normalsBuffer,
        mr.gpu.tangentsBuffer,
      ]);

      const computeCommandEncoder = GPU.device.createCommandEncoder();
      const computePassEncoder = computeCommandEncoder.beginComputePass();
      computePassEncoder.setPipeline(skinningPipeline);
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
