import { mat4, quat, vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";
import { Transform } from "./Transform.js";

// ---- カプセルコライダー ----
function capsuleClosestPoint(cap, p) {
  const ab = vec3.sub(cap.p1, cap.p0);
  const abl = vec3.length(ab) || 1;
  const t = vec3.clamp(vec3.dot(vec3.sub(p, cap.p0), ab) / (abl * abl), 0, 1);
  return vec3.add(cap.p0, vec3.mul(ab, t));
}
function capsulePushOut(p3, v3, cap) {
  const closest = capsuleClosestPoint(cap, p3);
  const dc = vec3.sub(p3, closest);
  const r = vec3.length(dc);
  const minR = cap.radius + 0.05;
  if (r < minR && r > 0.001) {
    const n = vec3.mul(dc, 1 / r);
    const pen = minR - r;
    const np = vec3.add(p3, vec3.scale(n, pen));
    const nv = vec3.copy(v3);
    const vn2 = vec3.dot(v3, n);
    if (vn2 < 0) {
      vec3.sub(nv, vec3.scale(n, vn2), nv);
    }
    return { pos: np, vel: nv, hit: true };
  }
  return { pos: p3, vel: v3, hit: false };
}
function spherePushOut(p3, v3, col) {
  const dc = vec3.sub(p3, col.p0);
  const r = vec3.length(dc);
  const minR = col.radius + 0.05;
  if (r < minR && r > 0.001) {
    const n = vec3.mul(dc, 1 / r);
    const pen = minR - r;
    const np = vec3.add(p3, vec3.scale(n, pen));
    const nv = vec3.copy(v3);
    const vn2 = vec3.dot(v3, n);
    if (vn2 < 0) {
      vec3.sub(nv, vec3.scale(n, vn2), nv);
    }
    return { pos: np, vel: nv, hit: true };
  }
  return { pos: p3, vel: v3, hit: false };
}

function quatFromTo(from, to) {
  const f = vec3.normalize(from);
  const t = vec3.normalize(to);
  const dot = vec3.dot(f, t);
  if (dot >= 0.9999) return [0, 0, 0, 1]; // 同方向
  if (dot <= -0.9999) {
    // 180度反転：任意の垂直軸で回す
    let perp = vec3.cross(f, [1, 0, 0]);
    if (vec3.length(perp) < 0.001) perp = vec3.cross(f, [0, 1, 0]);
    const axis = vec3.normalize(perp);
    return [axis[0], axis[1], axis[2], 0]; // 180度
  }
  const axis = vec3.cross(f, t);
  const w = 1 + dot;
  const l = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2 + w ** 2);
  return [axis[0] / l, axis[1] / l, axis[2] / l, w / l];
}

// parentQuat: 親ボーンの現在のワールドクォータニオン
// restDir:    このボーンのローカルrest方向（正規化済み）
// toDir:      物理で求めたhead→tailのワールド方向
function quatFromToNoTwist(parentQuat, restDir, toDir) {
  // 親クォータニオンでrestDirをワールド変換 → ボーンのrest方向(world)
  const restWorld = vec3.transformQuat(restDir, parentQuat);

  // restWorld → toDir への最短回転（スイング成分のみ）
  const swing = quatFromTo(restWorld, toDir);

  // 親のクォータニオンにスイングを合成
  return quat.mul(swing, parentQuat);
}

export class DynamicBone {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;

    this.damping = 0.9;
    this.inertia = 0.9; // どれだけその場に止まるか
    this.massInverse = 1 / 10; // 1 / mass
    this.gravity = 0.9;
    this.velLimit = Infinity; // 速度の上限
    this.restStiffness = 0.65; // どれだけ元の姿勢に戻るか
    this.step = 1 / 60;

    this.wind = vec3.create(0, 0, 0);

    /** @type {Transform[]} */
    this.transforms = [];
    this.isReset = false;
    this.position = [];
    this.lastPosition = [];
    this.velocity = [];
    this.restDir = [];
    this.length = [];
  }

  reset() {
    this.transforms.length = 0;
    /** @type {Transform} */
    let transform = this.gameObject.getComponent(Transform);
    this.position.length = 0;
    this.velocity.length = 0;
    this.position.push(vec3.create());
    this.velocity.push(vec3.create());
    this.restDir = [];
    while (true) {
      this.transforms.push(transform);
      this.position.push(vec3.create());
      this.velocity.push(vec3.create());
      const child = transform.getChild(0);
      if (!child) break;
      transform = child;
    }
    this.isReset = true;
    console.log(this);
  }

  lengthLimit() {}

  angleLimit() {}

  checkCollision() {}

  updateSpring(time, colliders) {
    const delta = Math.max(time - this.lastTime, 0.001);
    this.lastTime = time;
    this.remaining += delta;
    // 初期設定
    if (!this.isReset) {
      this.reset();
    }
    const b = this.transforms[0].getWorldPosition();

    const step = this.step;
    const massInverse = this.massInverse * step;
    const [wx, wy, wz] = this.wind;
    vec3.copy(b, this.position[0]);

    for (let i = 0; i < this.position.length - 1; i++) {
      const head = this.position[i];
      const tail = vec3.copy(this.position[i + 1]);
      const newTail = vec3.copy(this.position[i + 1]);
      const vel = vec3.copy(this.velocity[i + 1]);
      const transform = this.transforms[i];
      const l = transform.length;
      const restTarget = vec3.add(
        transform.getWorldPosition(),
        vec3.scale(transform.getWorldForward(), transform.length),
      );

      const rd = vec3.transformMat4Direction(
        vec3.sub(restTarget, transform.getWorldPosition()),
        mat4.inverse(transform.getWorldMatrix()),
      );

      // rest pose 収束力
      const rs = this.restStiffness;
      vec3.add(vel, vec3.scale(vec3.sub(restTarget, tail), rs), vel);

      // 外力
      // 親要素の速度を引き継ぐ
      // vec3.sub(vel, a, vel);
      vec3.add(
        vel,
        vec3.scale(vec3.create(wx, wy - this.gravity, wz), massInverse),
        vel,
      );

      const cl3 = vec3.clampLen(vel, this.velLimit);
      vec3.add(tail, vel, newTail);
      vec3.scale(cl3, this.damping, vel);

      // 慣性で戻す
      const d4 = vec3.sub(this.position[i + 1], newTail); // 前フレームとの差
      vec3.add(vel, vec3.scale(d4, this.inertia), vel);

      // 長さ拘束
      const d2 = vec3.sub(newTail, head);
      const dl = vec3.length(d2) || 1;
      // const corr = vec3.scale(d2, (l / dl - 1) * 0.5);
      // 長さを保つ
      const corr = vec3.scale(d2, (l / dl - 1) * 1);
      vec3.add(newTail, corr, newTail);

      // コライダー押し出し
      for (const col of colliders) {
        const res = col.isSphere
          ? spherePushOut(newTail, vel, col)
          : capsulePushOut(newTail, vel, col);
        if (res.hit) {
          vec3.copy(res.pos, newTail);
          vec3.copy(res.vel, vel);
        }
      }
      vec3.copy(newTail, this.position[i + 1]);
      vec3.copy(vel, this.velocity[i + 1]);

      transform.setWorldPosition(head);
      const parentQuat = transform.parent.getWorldRotation();
      const q = quatFromToNoTwist(
        parentQuat,
        rd,
        vec3.normalize(vec3.sub(newTail, head)),
      );
      transform.setWorldRotation(q);
    }
  }
}
