import { GameObject } from "../objects/GameObject.js";
import { Transform } from "./Transform.js";

export class IK {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;

    /** @type {Transform} */
    this.bone = null;

    // 親を何度伝播するか
    /** @type {Number} */
    this.chainCount = 1;

    /** @type {Transform} */
    this.target = null;
    /** @type {Transform} */
    this.poleTarget = null;
    /** @type {Number} */
    this.poleAngle = 0;

    /** @type {Number} */
    this.effectorLength = 0;
  }

  setBone(bone) {
    this.bone = bone;
  }

  setChainCount(chainCount) {
    this.chainCount = chainCount;
  }

  setTarget(target) {
    this.target = target;
  }

  setPoleTarget(poleTarget) {
    this.poleTarget = poleTarget;
  }

  setPoleAngle(poleAngle) {
    this.poleAngle = poleAngle;
  }

  setEffectorLength(effectorLength) {
    this.effectorLength = effectorLength;
  }
}