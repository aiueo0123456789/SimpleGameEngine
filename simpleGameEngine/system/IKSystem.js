/**
 * https://zenn.dev/mogesystem/scraps/5ca77b2fe1be2b <- 参考にしたサイト
 */

import { mat4, quat, vec3 } from "../../webgpuMatrix.js";
import { IK } from "../component/IK.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";

function fromToRotation(before, after) {
  const axis = vec3.normalize(vec3.cross(before, after));
  const angle = Math.acos(Math.max(-1, Math.min(1, vec3.dot(before, after))));
  return quat.fromAxisAngle(axis, angle);
}

function projectOnPlane(bend, straight) {
  return vec3.sub(bend, vec3.scale(straight, vec3.dot(bend, straight)));
}

function clampAngle(angle, min, max) {
  // -180~180の範囲に正規化してからクランプ
  angle = ((angle % 360) + 360) % 360;
  if (angle > 180) angle -= 360;
  return Math.max(min, Math.min(max, angle));
}

// オイラー変換（wgpu-matrixにない場合の実装）
function quatToEuler(q) {
  // ZYX順（Unity互換）
  const [x, y, z, w] = q;
  const sinX = 2 * (w * x - y * z);
  const ex = (Math.asin(Math.max(-1, Math.min(1, sinX))) * 180) / Math.PI;
  const ey =
    (Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)) * 180) / Math.PI;
  const ez =
    (Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)) * 180) / Math.PI;
  return [ex, ey, ez];
}

function eulerToQuat(e) {
  const [ex, ey, ez] = e.map((v) => (v * Math.PI) / 180);
  return quat.fromEuler(ex, ey, ez, "xyz"); // wgpu-matrixのAPI
}

export class IKSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  _getEffectorPosition(
    /** @type {Transform} */ effector,
    /** @type {Number} */ effectorLength,
  ) {
    return vec3.add(
      effector.getWorldPosition(),
      vec3.scale(effector.getWorldForward(), effectorLength),
    );
  }

  _applyRotationLimit(/** @type {Transform} */ transform, limits) {
    // ワールド回転 → ローカル回転 → オイラー → クランプ → 戻す
    const localQ = transform.rotation;
    const euler = quatToEuler(localQ); // 要実装（後述）

    euler[0] = clampAngle(euler[0], limits.x[0], limits.x[1]);
    euler[1] = clampAngle(euler[1], limits.y[0], limits.y[1]);
    euler[2] = clampAngle(euler[2], limits.z[0], limits.z[1]);

    transform.setRotation(eulerToQuat(euler));
  }

  _alignRoll(/** @type {Transform} */ transform, boneForward, upHint) {
    const left = vec3.normalize(vec3.cross(upHint, boneForward));
    const up = vec3.normalize(vec3.cross(left, boneForward));

    const currentUp = transform.getWorldUp(); // 実装依存
    return fromToRotation(currentUp, up);
  }

  _getDeltaRotation(origin, current, target) {
    // 始点と終点が近すぎたら回転させない
    if (vec3.distance(origin, target) < 1e-6) return quat.identity();

    var beforeDirection = vec3.normalize(vec3.sub(current, origin));
    var afterDirection = vec3.normalize(vec3.sub(target, origin));
    return fromToRotation(beforeDirection, afterDirection);
  }

  _getJointPosition(
    bone1Position,
    bone2Position,
    targetPosition,
    poleTargetPosition,
    poleAngle,
    effectorPosition,
  ) {
    var distance = vec3.distance(targetPosition, bone1Position);
    var length1 = vec3.distance(bone2Position, bone1Position);
    var length2 = vec3.distance(effectorPosition, bone2Position);

    var straight = vec3.normalize(vec3.sub(targetPosition, bone1Position));

    if (
      distance <= Math.abs(length2 - length1) ||
      distance >= length1 + length2
    ) {
      return vec3.add(vec3.scale(straight, length1), bone1Position);
    }

    var midLength =
      (length1 * length1 + distance * distance - length2 * length2) /
      (2 * distance);
    var midPoint = vec3.add(vec3.scale(straight, midLength), bone1Position);

    var radius = Math.sqrt(length1 * length1 - midLength * midLength);

    // ポールターゲット方向を平面上へ射影
    var pole = vec3.sub(poleTargetPosition, midPoint);
    var poleOnPlane = projectOnPlane(pole, straight);
    const poleLen = vec3.length(poleOnPlane);
    if (poleLen < 1e-6) {
      const fallback =
        Math.abs(straight[1]) < 0.9
          ? vec3.normalize(vec3.cross(straight, [0, 1, 0]))
          : vec3.normalize(vec3.cross(straight, [1, 0, 0]));
      poleOnPlane = fallback;
    } else {
      poleOnPlane = vec3.normalize(poleOnPlane);
    }

    // poleAngle分だけstraightを軸に回転
    if (poleAngle !== 0) {
      const rotQ = quat.fromAxisAngle(straight, poleAngle);
      poleOnPlane = vec3.transformQuat(poleOnPlane, rotQ);
    }

    return vec3.add(vec3.scale(poleOnPlane, radius), midPoint);
  }

  _twoBone(/** @type {IK} */ ik) {
    const [bone2, bone1] = this._getChainBones(ik.bone, 2); // エフェクターから辿るから
    // ジョイントの位置を求める
    const jointPosition = this._getJointPosition(
      bone1.getWorldPosition(),
      bone2.getWorldPosition(),
      ik.target.getWorldPosition(),
      ik.poleTarget.getWorldPosition(),
      ik.poleAngle,
      this._getEffectorPosition(bone2, ik.effectorLength),
    );

    // 親ボーンをジョイントへ向ける
    const delta1 = this._getDeltaRotation(
      bone1.getWorldPosition(),
      bone2.getWorldPosition(),
      jointPosition,
    );
    bone1.setWorldRotation(quat.mul(delta1, bone1.getWorldRotation()));

    // ロール補正
    const rollDelta = this._alignRoll(
      bone1,
      vec3.normalize(vec3.sub(jointPosition, bone1.getWorldPosition())),
      vec3.sub(ik.poleTarget.getWorldPosition(), bone1.getWorldPosition()),
    );
    bone1.setWorldRotation(quat.mul(rollDelta, bone1.getWorldRotation()));

    // 子ボーンをターゲットへ向ける
    const delta2 = this._getDeltaRotation(
      jointPosition,
      this._getEffectorPosition(bone2, ik.effectorLength),
      ik.target.getWorldPosition(),
    );
    bone2.setWorldRotation(quat.mul(delta2, bone2.getWorldRotation()));
  }

  _oneBone(/** @type {IK} */ ik) {
    const bone1 = ik.bone;

    // ボーンをターゲットへ向ける
    const delta = this._getDeltaRotation(
      bone1.getWorldPosition(),
      this._getEffectorPosition(bone1, ik.effectorLength),
      ik.target.getWorldPosition(),
    );
    bone1.setWorldRotation(quat.mul(delta, bone1.getWorldRotation()));

    if (ik.poleTarget) {
      // ロール補正
      const rollDelta = this._alignRoll(
        bone1,
        vec3.normalize(
          vec3.sub(ik.target.getWorldPosition(), bone1.getWorldPosition()),
        ),
        vec3.sub(ik.poleTarget.getWorldPosition(), bone1.getWorldPosition()),
      );
      bone1.setWorldRotation(quat.mul(rollDelta, bone1.getWorldRotation()));
    }
  }

  _getChainBones(/** @type {Transform} */ bone, chainCount) {
    const r = [];
    let current = bone;
    for (let i = 0; i < chainCount; i++) {
      r.push(current);
      current = current.parent;
    }
    return r;
  }

  update() {
    /** @type {IK[]} */
    const IKBones = this.engine.scene.getComponents(IK);
    for (const ik of IKBones) {
      if (ik.chainCount == 1) {
        this._oneBone(ik);
      } else if (ik.chainCount == 2) {
        this._twoBone(ik);
      } else {

      }
    }
  }
}
