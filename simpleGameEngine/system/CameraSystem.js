import { Camera } from "../component/camera.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";

export class CameraSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  update() {
    /** @type {Camera[]} */
    const cameras = this.engine.scene.getComponents(Camera);
    for (const cam of cameras) {
      /** @type {Transform} */
      const transform = cam.gameObject.getComponent(Transform);
      cam.updateMatrix(transform);
    }
  }
}
