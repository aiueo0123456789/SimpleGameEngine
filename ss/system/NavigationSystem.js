import { quat, vec3 } from "../../webgpuMatrix.js";
import { Navigation } from "../component/Navigation.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";

const deltaTime = 1 / 60;

export class NavigationSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  update() {
    /** @type {Navigation[]} */
    const navigationComponents = this.engine.scene.getComponents(Navigation);
    for (const navigationComponent of navigationComponents) {
      /** @type {Transform} */
      const transform = navigationComponent.gameObject.getComponent(Transform);
      const sub = vec3.sub(navigationComponent.target, transform.position);
      const deltaSpeed = navigationComponent.speed * deltaTime;
      if (vec3.length(sub) <= deltaSpeed) {
        navigationComponent.arrived = true;
        transform.setPosition(transform.position);
        continue;
      }
      const direction = vec3.normalize(sub);
      // 方向ベクトルからクォータニオンを生成
      const forward = [0, 0, 1]; // デフォルトの前方向
      const dot = vec3.dot(forward, direction);

      let q;
      if (dot >= 1.0 - 1e-6) {
        // 同方向：回転なし
        q = quat.identity();
      } else if (dot <= -1.0 + 1e-6) {
        // 真逆：Y軸で180度回転
        q = quat.fromAxisAngle([0, 1, 0], Math.PI);
      } else {
        const axis = vec3.normalize(vec3.cross(forward, direction));
        const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
        q = quat.fromAxisAngle(axis, angle);
      }

      transform.setRotation(q);
      transform.setPosition(
        vec3.add(transform.position, vec3.scale(direction, deltaSpeed)),
      );
    }
  }
}
