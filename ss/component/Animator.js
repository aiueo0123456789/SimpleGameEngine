import { quat, vec3 } from "../../webgpuMatrix.js";
import {
  AnimationState,
  AnimatorController,
} from "../assetsManager/AnimatorControllerManager.js";
import { GameObject } from "../objects/GameObject.js";
import { ArmaturePose, BonePose } from "./Armature.js";

class State {
  constructor(startTime) {
    /** @type {AnimationState} */
    this.state = null;
    this.time = startTime;
  }

  get normalizedTime() {
    return (
      (this.time - this.state.startTime) /
      (this.state.endTime - this.state.startTime)
    );
  }
}

class Transition {
  constructor() {
    this.blendTime = 0;
    this.transitionDuration = 0;
  }

  get blendWeight() {
    if (this.transitionDuration <= 0) return 1;
    return this.blendTime / this.transitionDuration;
  }
}

export class Animator {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;

    // this.animationDatas = new Map();
    /** @type {AnimatorController} */
    this.animatorController = null;

    /** @type {State} */
    this.currentState = null;
    /** @type {State} */
    this.nextState = null;
    this.transition = new Transition();
    this.parameters = {};

    /** @type {ArmaturePose} */
    this.restPose = null;

    /** @type {ArmaturePose} */
    this.dynamicPose = null;
  }

  /**
   * レストポーズのアーマチュアポーズを返す
   * @returns {ArmaturePose}
   */
  getRestPoseBuffer() {
    const r = new ArmaturePose(this.restPose.bones.length);
    for (let i = 0; i < this.restPose.bones.length; i++) {
      const pose = this.restPose.bones[i];
      r.bones[i].setPosition(pose.position);
      r.bones[i].setRotation(pose.rotation);
      r.bones[i].setScale(pose.scale);
    }
    return r;
  }

  /**
   *
   * @param {ArmaturePose} armaturePose
   */
  setRestPose(armaturePose) {
    this.restPose = armaturePose;
    this.dynamicPose = new ArmaturePose(armaturePose.bones.length);
  }

  /**
   *
   * @param {AnimationState} animationState
   * @returns {State}
   */
  createState(animationState) {
    const state = new State(animationState.startTime);
    state.state = animationState;
    return state;
  }

  /**
   *
   * @param {AnimatorController} animatorController
   */
  setAnimatorController(animatorController) {
    this.animatorController = animatorController;
    this.parameters = {};
    for (const parameter of animatorController.parameters) {
      this.parameters[parameter] = 0;
    }
  }

  /**
   *
   * @param {*} parameter
   * @param {*} value
   */
  setParameter(parameter, value) {
    this.parameters[parameter] = value;
  }
}
