import { DynamicBone } from "../component/DynamicBone.js";
import { Engine } from "../core/Engine.js";

export class DynamicBoneSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  update() {
    /** @type {DynamicBone[]} */
    const dynamicBones = this.engine.scene.getComponents(DynamicBone);
    for (const dynamicBone of dynamicBones) {
      dynamicBone.updateSpring(this.engine.time, []);
    }
  }
}
