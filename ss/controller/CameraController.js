import { mat4, quat, vec3 } from "../../webgpuMatrix.js";
import { BoxCollider } from "../component/BoxCollider.js";
import { Camera } from "../component/camera.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";
import { InputManager } from "../manager/InputManager.js";
import { GameObject } from "../objects/GameObject.js";
import { PhysicsSystem } from "../system/PhysicsSystem.js";

export class CameraController {
  constructor(/** @type {Engine} */ engine) {
    /** @type {PhysicsSystem} */
    this.physicsSystem = engine.getSystem(PhysicsSystem);
    /** @type {InputManager} */
    this.input = engine.getManager(InputManager);
    /** @type {Camera} */
    this.mainCamera = engine.scene.getComponents(Camera)[0];
    /** @type {GameObject} */
    this.playerGameObject = engine.scene.getObjectByID("player_arm");
    this.zoom = 10;
    this.rotation = [0, 0];
    this.targetPosition = vec3.create();
  }

  update() {
    /** @type {Transform} */
    const cameraTransform = this.mainCamera.gameObject.getComponent(Transform);
    if (this.input.getKey("Mouse0")) {
      this.rotation[0] += this.input.mouseMovement[0] / 500;
      this.rotation[1] += this.input.mouseMovement[1] / 500;
    }
    this.zoom += this.input.mouseScrollDelta[1] / 20;
    const rxz = Math.cos(this.rotation[1]);

    vec3.add(
      this.targetPosition,
      vec3.scale(
        vec3.sub(
          this.playerGameObject.getComponent(Transform).position,
          this.targetPosition,
        ),
        0.8,
      ),
      this.targetPosition,
    );
    const playerCollider = this.playerGameObject.getComponent(BoxCollider);

    const dir = [
      Math.sin(this.rotation[0]) * rxz,
      Math.sin(this.rotation[1]),
      Math.cos(this.rotation[0]) * rxz,
    ];
    // const raycastResult = this.physicsSystem.raycast(
    //   this.targetPosition,
    //   dir,
    //   playerCollider,
    // );
    let t = this.zoom;
    // if (raycastResult) t = Math.max(1, Math.min(t, raycastResult.distance - 1));
    const cameraPosition = vec3.add(this.targetPosition, vec3.scale(dir, t));
    cameraTransform.setPosition(cameraPosition);

    // カメラ→プレイヤーへの方向ベクトル（+Z前）
    const forward = vec3.normalize(
      vec3.subtract(this.targetPosition, cameraPosition),
    );

    // 極値対策：forwardがほぼ真上/真下のときrightがゼロになるのを防ぐ
    const worldUp = Math.abs(forward[1]) < 0.999 ? [0, 1, 0] : [0, 0, 1];

    // 左手系: right = up × forward（Unity準拠）
    const right = vec3.normalize(vec3.cross(worldUp, forward));
    const up = vec3.normalize(vec3.cross(forward, right));

    // 回転行列（列優先）
    // +X = right, +Y = up, +Z = forward
    const rotMat = mat4.create();
    rotMat[0] = right[0];
    rotMat[1] = right[1];
    rotMat[2] = right[2];
    rotMat[3] = 0;
    rotMat[4] = up[0];
    rotMat[5] = up[1];
    rotMat[6] = up[2];
    rotMat[7] = 0;
    rotMat[8] = forward[0];
    rotMat[9] = forward[1];
    rotMat[10] = forward[2];
    rotMat[11] = 0;
    rotMat[12] = 0;
    rotMat[13] = 0;
    rotMat[14] = 0;
    rotMat[15] = 1;

    const q = quat.fromMat(rotMat);
    cameraTransform.setRotation(q);
  }
}
