import { mat3, quat, vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";
import { Transform } from "./Transform.js";

export class Rigidbody {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    this.mass = 1;
    this.useGravity = true;
    this.isKinematic = false;

    this.inertiaTensor = vec3.create(1157.344, 1864.285, 847.4844);
    this.inertiaTensorRotation = quat.create(0.01929886, 0.0, 0.0, 0.9998138);
    // this.centerOfMass = vec3.create(0, 0.62495, 1.270834);
    this.centerOfMass = vec3.create(0, -0.2, 1.2);
    this.force = vec3.create();
    this.torque = vec3.create();
    this.velocity = vec3.create();
    this.angularVelocity = vec3.create();
  }

  setMass(mass) {
    this.mass = mass;
  }
  setIsKinematic(isKinematic) {
    this.isKinematic = isKinematic;
  }

  // ─────────────────────────────────────────
  // 力の追加（重心への力 → トルクなし）
  // ─────────────────────────────────────────
  addForce(force) {
    vec3.add(this.force, force, this.force);
  }

  addTorque(torque) {
    vec3.add(this.torque, torque, this.torque);
  }

  getWorldCenterOfMass() {
    /** @type {Transform} */
    const transform = this.gameObject.getComponent(Transform);
    return vec3.transformMat4(this.centerOfMass, transform.getWorldMatrix());
  }

  /**
   * 特定のワールド座標点に力を加える
   * → 重心からズレていればトルクが発生する
   *
   * @param {vec3} force         - 加える力（ワールド空間）
   * @param {vec3} worldPosition - 力の作用点（ワールド空間）
   */
  addForceAtPosition(force, worldPosition) {
    // 線形力はそのまま加算
    vec3.add(this.force, force, this.force);

    // トルク = r × F  （r = 作用点 - 世界重心）
    const worldCoM = this.getWorldCenterOfMass();
    const r = vec3.sub(worldPosition, worldCoM);
    const torque = vec3.cross(r, force);
    vec3.add(this.torque, torque, this.torque);
  }

  /**
   * ローカル座標点に力を加える（ボーン・アタッチポイントなど）
   *
   * @param {vec3} force          - 加える力（ワールド空間）
   * @param {vec3} localPosition  - 力の作用点（ローカル空間）
   */
  addForceAtLocalPosition(force, localPosition) {
    /** @type {Transform} */
    const transform = this.gameObject.getComponent(Transform);
    const worldPosition = vec3.transformMat4(
      localPosition,
      transform.getWorldMatrix(),
    );
    this.addForceAtPosition(force, worldPosition);
  }

  // ─────────────────────────────────────────
  // 重力を重心に適用（トルクなし）
  // ─────────────────────────────────────────
  applyGravity() {
    if (!this.useGravity || this.isKinematic) return;
    // F = m * g
    this.addForce(vec3.create(0, -9.81 * this.mass, 0));
  }

  // ─────────────────────────────────────────
  // 位置更新（drag対応）
  // ─────────────────────────────────────────
  updatePosition() {
    if (this.isKinematic) return;

    const transform = this.gameObject.getComponent(Transform);
    const dt = this.gameObject.engine.deltaTime;

    // 加速度 → 速度
    vec3.add(
      this.velocity,
      vec3.scale(this.force, dt / this.mass),
      this.velocity,
    );

    // 速度 → 位置
    vec3.add(
      transform.position,
      vec3.scale(this.velocity, dt),
      transform.position,
    );

    vec3.zero(this.force);
  }

  // ─────────────────────────────────────────
  // 回転更新（angularDrag対応）
  // ─────────────────────────────────────────
  updateRotation() {
    if (this.isKinematic) return;

    const transform = this.gameObject.getComponent(Transform);
    const dt = this.gameObject.engine.deltaTime;

    // 1. 慣性テンソルをワールド空間へ変換
    const bodyQuat = quat.multiply(
      transform.rotation,
      this.inertiaTensorRotation,
    );
    const rotationMatrix = mat3.create();
    mat3.fromQuat(bodyQuat, rotationMatrix);

    const localInertiaTensor = mat3.create(
      this.inertiaTensor[0],
      0,
      0,

      0,
      this.inertiaTensor[1],
      0,

      0,
      0,
      this.inertiaTensor[2],
    );

    const worldInertiaTensor = mat3.create();
    const tempMatrix = mat3.multiply(rotationMatrix, localInertiaTensor);
    mat3.multiply(
      tempMatrix,
      mat3.transpose(rotationMatrix),
      worldInertiaTensor,
    );

    // 2. 逆慣性テンソル
    const invWorldInertiaTensor = mat3.invert(worldInertiaTensor);
    if (!invWorldInertiaTensor) return;

    // 3. 角加速度
    // ジャイロ項はフラップ抵抗のみで収束させる場合は除去も検討
    const Iomega = vec3.transformMat3(this.angularVelocity, worldInertiaTensor);
    const gyro = vec3.cross(this.angularVelocity, Iomega);
    const correctedTorque = vec3.sub(this.torque, gyro);
    const angularAcceleration = vec3.transformMat3(
      correctedTorque,
      invWorldInertiaTensor,
    );

    // 4. 角速度を更新
    vec3.add(
      this.angularVelocity,
      vec3.scale(angularAcceleration, dt),
      this.angularVelocity,
    );

    const angularVelocityNormalize = vec3.normalize(this.angularVelocity);

    // 角速度クランプ
    if (vec3.lengthSq(this.angularVelocity) > 15 * 15) {
      vec3.scale(angularVelocityNormalize, 15, this.angularVelocity);
    }

    const angularVelocityMagnitude = vec3.length(this.angularVelocity);
    if (angularVelocityMagnitude > 1e-6) {
      const angularVelocityQuat = quat.create();
      quat.setAxisAngle(
        angularVelocityNormalize,
        angularVelocityMagnitude * dt,
        angularVelocityQuat,
      );

      quat.multiply(
        angularVelocityQuat,
        transform.rotation,
        transform.rotation,
      );
      quat.normalize(transform.rotation, transform.rotation);
    }

    vec3.zero(this.torque);
  }
}
