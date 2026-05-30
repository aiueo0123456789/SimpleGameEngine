import { GameObject } from "../objects/GameObject.js";
import { Armature } from "./Armature.js";

export class Skinning {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    /** @type {Armature} */
    this.armature = null;
  }

  setArmature(/** @type {Armature} */ armature) {
    if (armature instanceof Armature) this.armature = armature;
    else console.error("型はArmatureである必要があります", armature);
  }
}
