import { Light } from "../component/Light.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";

export class LightSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  update() {
    /** @type {Light[]} */
    const lights = this.engine.scene.getComponents(Light);
    for (const light of lights) {
      /** @type {Transform} */
      const transform = light.gameObject.getComponent(Transform);
      light.updateMatrix(transform);
    }
  }
}
