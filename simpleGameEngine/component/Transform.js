import { mat4, vec3, quat } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";

export class Transform {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    this.name = "";
    /** @type {Transform | null} */
    this.parent = null;
    /** @type {Transform[]} */
    this.children = [];
    this.position = vec3.create();
    this.rotation = quat.identity(); // クォータニオン [x, y, z, w]
    this.scale = vec3.fromValues(1, 1, 1);

    /** @type {Number} */
    this.length = 0; // ボーンなど一部で使う

    this.useInheritRotation = true;
  }

  setName(name) {
    this.name = name;
  }

  setLength(length) {
    this.length = length;
  }

  setUseInheritRotation(useInheritRotation) {
    this.useInheritRotation = useInheritRotation;
  }

  setPosition(position) {
    vec3.set(position[0], position[1], position[2], this.position);
  }

  setRotation(q) {
    quat.normalize(q, this.rotation);
  }

  setWorldPosition(worldPosition) {
    if (this.parent) {
      vec3.transformMat4(
        worldPosition,
        mat4.inverse(this.parent.getWorldMatrix()),
        this.position,
      );
    } else {
      this.setPosition(worldPosition);
    }
  }

  setWorldRotation(q) {
    if (this.parent) {
      this.setRotation(
        quat.mul(quat.inverse(this.parent.getWorldRotation()), q),
      );
    } else {
      this.setRotation(q);
    }
  }

  setScale(scale) {
    vec3.set(scale[0], scale[1], scale[2], this.scale);
  }

  setLocalMatrix(m) {
    // position
    vec3.set(m[12], m[13], m[14], this.position);
    // scale
    let sx = Math.hypot(m[0], m[1], m[2]);
    let sy = Math.hypot(m[4], m[5], m[6]);
    let sz = Math.hypot(m[8], m[9], m[10]);
    // 正規化回転行列
    let r00 = m[0] / sx,
      r10 = m[1] / sx,
      r20 = m[2] / sx;
    let r01 = m[4] / sy,
      r11 = m[5] / sy,
      r21 = m[6] / sy;
    let r02 = m[8] / sz,
      r12 = m[9] / sz,
      r22 = m[10] / sz;
    // determinantチェック（重要）
    const det =
      r00 * (r11 * r22 - r12 * r21) -
      r01 * (r10 * r22 - r12 * r20) +
      r02 * (r10 * r21 - r11 * r20);
    if (det < 0) {
      sx = -sx;
      r00 = -r00;
      r10 = -r10;
      r20 = -r20;
    }
    vec3.set(sx, sy, sz, this.scale);
    // quaternion変換（そのままでOK）
    const trace = r00 + r11 + r22;
    let qx, qy, qz, qw;
    if (trace > 0) {
      const s = Math.sqrt(trace + 1.0) * 2;
      qw = 0.25 * s;
      qx = (r21 - r12) / s;
      qy = (r02 - r20) / s;
      qz = (r10 - r01) / s;
    } else if (r00 > r11 && r00 > r22) {
      const s = Math.sqrt(1.0 + r00 - r11 - r22) * 2;
      qw = (r21 - r12) / s;
      qx = 0.25 * s;
      qy = (r01 + r10) / s;
      qz = (r02 + r20) / s;
    } else if (r11 > r22) {
      const s = Math.sqrt(1.0 + r11 - r00 - r22) * 2;
      qw = (r02 - r20) / s;
      qx = (r01 + r10) / s;
      qy = 0.25 * s;
      qz = (r12 + r21) / s;
    } else {
      const s = Math.sqrt(1.0 + r22 - r00 - r11) * 2;
      qw = (r10 - r01) / s;
      qx = (r02 + r20) / s;
      qy = (r12 + r21) / s;
      qz = 0.25 * s;
    }
    quat.set(qx, qy, qz, qw, this.rotation);
  }

  setParent(/** @type {Transform} */ parent) {
    if (parent.children.includes(this))
      this.parent.children.splice(parent.children.indexOf(this), 1);
    this.parent = parent;
    this.parent.children.push(this);
  }

  getChild(index) {
    if (index < this.children.length) return this.children[index];
    else return null;
  }

  getLocalMatrix() {
    const r = mat4.fromQuat(this.rotation); // クォータニオン→回転行列
    const model = mat4.identity();
    mat4.translate(model, this.position, model);
    mat4.multiply(model, r, model);
    mat4.scale(model, this.scale, model);
    return model;
  }

  getWorldMatrix() {
    if (this.parent)
      if (this.useInheritRotation)
        return mat4.multiply(
          this.parent.getWorldMatrix(),
          this.getLocalMatrix(),
        );
      else {
        const parentWorld = this.parent.getWorldMatrix();
        const parentPos = mat4.getTranslation(parentWorld);
        const parentTranslation = mat4.translation(parentPos);
        return mat4.multiply(parentTranslation, this.getLocalMatrix());
      }
    else return this.getLocalMatrix();
  }

  getWorldForward() {
    return vec3.normalize(
      vec3.transformQuat([0, 0, 1], this.getWorldRotation()),
    );
  }
  getWorldRight() {
    return vec3.normalize(
      vec3.transformQuat([1, 0, 0], this.getWorldRotation()),
    );
  }
  getWorldUp() {
    return vec3.normalize(
      vec3.transformQuat([0, 1, 0], this.getWorldRotation()),
    );
  }

  getLocalForward() {
    const r = mat4.fromQuat(this.rotation);
    return vec3.normalize(vec3.transformMat4([0, 0, 1], r));
  }
  getLocalRight() {
    const r = mat4.fromQuat(this.rotation);
    return vec3.normalize(vec3.transformMat4([1, 0, 0], r));
  }
  getLocalUp() {
    const r = mat4.fromQuat(this.rotation);
    return vec3.normalize(vec3.transformMat4([0, 1, 0], r));
  }

  getWorldPosition() {
    if (this.parent)
      return vec3.transformMat4(this.position, this.parent.getWorldMatrix());
    else return this.position;
  }

  getWorldRotation() {
    if (this.useInheritRotation && this.parent)
      return quat.mul(this.parent.getWorldRotation(), this.rotation);
    else return this.rotation;
  }

  getWorldScale() {
    if (this.useInheritRotation && this.parent)
      return vec3.mul(this.parent.getWorldScale(), this.scale);
    else return this.scale;
  }
}
