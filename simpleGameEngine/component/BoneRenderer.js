import { GameObject } from "../objects/GameObject.js";
import { GPU } from "../utils/webGPU.js";
import { Armature } from "./Armature.js";

class GPUDataManager {
  constructor() {
    this.boneBuffer = null;
  }

  update(/** @type {Armature} */ arm) {
    const needSize = arm.bones.length * (4 * 3) * 4;
    const data = GPU.createBitData(
      arm.bones
        .map((bone) => [
          ...Array.from(bone.getWorldPosition()),
          1.0,
          ...Array.from(bone.getWorldRotation()),
          ...Array.from(bone.getWorldScale()),
          bone.length,
        ])
        .flat(),
      ["f32"],
    );
    if (this.boneBuffer?.size == needSize) {
      GPU.writeBuffer(this.boneBuffer, data);
    } else {
      this.boneBuffer = GPU.createBuffer(needSize, ["v", "s"], data);
    }
  }
}

export class BoneRenderer {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;

    this.bonesNum = 0;

    this.gpu = new GPUDataManager();
  }

  updateArmature() {
    /** @type {Armature} */
    const arm = this.gameObject.getComponent(Armature);
    this.gpu.update(arm);
    this.bonesNum = arm.bonesNum;
  }
}
