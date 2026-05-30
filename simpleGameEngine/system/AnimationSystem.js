import { quat, vec3 } from "../../webgpuMatrix.js";
import { Animator } from "../component/Animator.js";
import { Armature, ArmaturePose } from "../component/Armature.js";
import { Engine } from "../core/Engine.js";

const deltaTime = 1 / 60;

function mixVec3(a, b, t) {
  return vec3.add(vec3.scale(a, 1 - t), vec3.scale(b, t));
}

function mixQuat(a, b, t) {
  return quat.slerp(a, b, t);
}

function sampleVec3(datas, time) {
  if (datas.length == 1) return datas[0].value;
  let left = datas[0];
  let right = datas[0];
  for (const data of datas.slice(1)) {
    if (data.time < time) right = data;
    else {
      left = right;
      right = data;
      break;
    }
  }
  const rightWeight = (time - left.time) / (right.time - left.time);
  return mixVec3(left.value, right.value, rightWeight);
}

function sampleQuat(datas, time) {
  if (datas.length == 1) return datas[0].value;
  let left = datas[0];
  let right = datas[0];
  for (const data of datas.slice(1)) {
    if (data.time < time) right = data;
    else {
      left = right;
      right = data;
      break;
    }
  }
  const leftWeight = (time - left.time) / (right.time - left.time);
  return mixQuat(left.value, right.value, leftWeight);
}

function checkConditions(conditions, parameters) {
  if (conditions.length == 0) return true;
  for (const condition of conditions) {
    const parameterValue = parameters[condition.parameter];
    const operator = condition.operator;
    const value = condition.value;
    if (operator == "==") return parameterValue == value;
    else if (operator == "!=") return parameterValue != value;
    else if (operator == "<") return parameterValue < value;
    else if (operator == ">") return parameterValue > value;
  }
}

export class AnimationSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  // 遷移
  evaluateTransitions(
    /** @type {Animator} */ animator,
    currentStatePrevNormalizedTime,
  ) {
    if (animator.nextState) return;
    for (const layer of animator.animatorController.layers) {
      if (!animator.currentState && !animator.nextState) {
        // currentもnextもないならentry
        for (const transition of layer.transitions.entry) {
          if (checkConditions(transition.conditions, animator.parameters)) {
            animator.nextState = animator.createState(transition.nextState);
            animator.transition.transitionDuration =
              transition.transitionDuration;
          }
        }
      }
      if (animator.currentState && !animator.nextState) {
        for (const transition of animator.currentState.state.transitions) {
          const floorTime = Math.floor(currentStatePrevNormalizedTime);
          const exitTime = transition.exitTime;
          if (
            (exitTime == 0 ||
              (currentStatePrevNormalizedTime - floorTime < exitTime &&
                animator.currentState.normalizedTime - floorTime >=
                  exitTime)) &&
            checkConditions(transition.conditions, animator.parameters)
          ) {
            animator.nextState = animator.createState(transition.nextState);
            animator.transition.transitionDuration =
              transition.transitionDuration;
            console.log("アニメーション切り替え", animator.nextState);
          }
        }
      }
    }
  }

  updateTime(animator) {
    if (animator.currentState) animator.currentState.time += deltaTime;
    if (animator.nextState) animator.nextState.time += deltaTime;
  }

  updateBlend(/** @type {Animator} */ animator) {
    if (animator.nextState) {
      animator.transition.blendTime += deltaTime;
      if (1 <= animator.transition.blendWeight) {
        animator.transition.blendTime = 0;
        animator.currentState = animator.nextState;
        animator.nextState = null;
        console.log("ブレンド終了切り替え", animator.currentState);
      }
    }
  }

  /**
   *
   * @param {Armature} armature
   * @param {*} state
   * @returns {ArmaturePose}
   */
  samplePoseFromState(armature, state) {
    // ボーンをアニメーション
    const pose = armature.createPose();
    if (state) {
      const animationClip = state.state.animatinoClip;
      let remainderTime = state.time;
      if (state.state.loopTime) {
        remainderTime %= state.state.endTime - state.state.startTime;
      }
      for (const boneAnimationData of animationClip.animationData) {
        const boneIndex = boneAnimationData.boneIndex;
        const animation = boneAnimationData.animation;
        const transformAnimation = animation.transform;
        pose.bones[boneIndex].setPosition(
          sampleVec3(transformAnimation.position, remainderTime),
        );
        pose.bones[boneIndex].setRotation(
          sampleQuat(transformAnimation.rotation, remainderTime),
        );
        pose.bones[boneIndex].setScale(
          sampleVec3(transformAnimation.scale, remainderTime),
        );
      }
    }
    return pose;
  }

  /**
   *
   * @param {ArmaturePose} workingPose
   * @param {ArmaturePose} pose
   * @param {Number} weight
   * @returns
   */
  addPose(workingPose, pose, weight) {
    weight = Math.min(Math.max(weight, 0.0), 1.0);
    if (workingPose.bones.length != pose.bones.length) return;
    for (let boneIndex = 0; boneIndex < workingPose.bones.length; boneIndex++) {
      const working = workingPose.bones[boneIndex];
      const add = pose.bones[boneIndex];

      if (add.orientType == "WORLD") {
        if (add.hasPosition) {
          vec3.lerp(working.position, add.position, weight, working.position);
        }
        if (add.hasRotation) {
          quat.slerp(working.rotation, add.rotation, weight, working.rotation);
        }
        if (add.hasScale) {
          vec3.lerp(working.scale, add.scale, weight, working.scale);
        }
      } else if (add.orientType == "LOCAL") {
        if (add.hasPosition) {
          vec3.add(working.position, add.position, working.position);
        }
        if (add.hasRotation) {
          quat.multiply(working.rotation, add.rotation, working.rotation);
        }
        if (add.hasScale) {
          vec3.add(working.scale, add.scale, working.scale);
        }
      }
    }
  }

  /**
   *
   * @param {Armature} armature
   * @param {ArmaturePose} pose
   */
  applyPose(armature, pose) {
    if (armature.bonesNum != pose.bones.length) return;
    for (let boneIndex = 0; boneIndex < armature.bonesNum; boneIndex++) {
      const bone = armature.bones[boneIndex];
      const bonePose = pose.bones[boneIndex];
      bone.setPosition(bonePose.position);
      bone.setRotation(bonePose.rotation);
      bone.setScale(bonePose.scale);
    }
  }

  update() {
    /** @type {Animator[]} */
    const animators = this.engine.scene.getComponents(Animator);
    for (const animator of animators) {
      const currentStatePrevNormalizedTime =
        animator.currentState?.normalizedTime;
      const workingPose = animator.getRestPoseBuffer();
      this.updateTime(animator);
      this.evaluateTransitions(animator, currentStatePrevNormalizedTime);
      this.updateBlend(animator);
      /** @type {Armature} */
      const armature = animator.gameObject.getComponent(Armature);
      if (animator.currentState) {
        if (animator.nextState) {
          this.addPose(
            workingPose,
            this.samplePoseFromState(armature, animator.currentState),
            1 - animator.transition.blendWeight,
          );
        } else {
          this.addPose(
            workingPose,
            this.samplePoseFromState(armature, animator.currentState),
            1,
          );
        }
      }
      if (animator.nextState) {
        this.addPose(
          workingPose,
          this.samplePoseFromState(armature, animator.nextState),
          animator.transition.blendWeight,
        );
      }
      this.addPose(workingPose, animator.dynamicPose, 1.0);
      this.applyPose(armature, workingPose);
    }
  }
}
