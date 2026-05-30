import { quat, vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";
import { Transform } from "./Transform.js";

export class BonePose {
  constructor() {
    /** @type {"WORLD" | "LOCAL"} */
    this.orientType = "WORLD";
    this.hasPosition = false;
    this.hasRotation = false;
    this.hasScale = false;
    this.position = vec3.create();
    this.rotation = quat.create();
    this.scale = vec3.create();
  }

  /**
   *
   * @param {"WORLD" | "LOCAL"} orientType
   */
  setOrientType(orientType) {
    this.orientType = orientType;
  }

  setPosition(position) {
    vec3.copy(position, this.position);
    this.hasPosition = true;
  }

  setRotation(rotation) {
    quat.copy(rotation, this.rotation);
    this.hasRotation = true;
  }

  setScale(scale) {
    vec3.copy(scale, this.scale);
    this.hasScale = true;
  }
}

export class ArmaturePose {
  /**
   *
   * @param {Number} bonesNum
   */
  constructor(bonesNum) {
    /** @type {BonePose[]} */
    this.bones = [...Array(bonesNum)].map((x) => new BonePose());
  }
}

export class Armature {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    /** @type {Transform[]} */
    this.bones = [];
  }

  getBoneByName(name) {
    for (const bone of this.bones) {
      if (bone.name == name) return bone;
    }
    return null;
  }

  /**
   * ポーズを作る
   * @returns {ArmaturePose}
   */
  createPose() {
    return new ArmaturePose(this.bonesNum);
  }

  get bonesNum() {
    return this.bones.length;
  }

  /**
   *
   * @param {Transform[]} bones
   */
  setBones(bones) {
    this.bones.length = 0;
    for (const bone of bones) {
      if (bone instanceof Transform) this.bones.push(bone);
      else console.error(`型はTransformである必要があります:`, bone);
    }
  }

  /**
   * ルートボーンを取得
   * @returns {Transform[]}
   */
  getRoot() {
    const r = [];
    for (const bone of this.bones) {
      if (!bone.parent) r.push(bone);
    }
    return r;
  }
}
