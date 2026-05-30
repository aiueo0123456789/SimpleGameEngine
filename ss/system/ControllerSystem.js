import { Controller } from "../component/Controller.js";
import { Engine } from "../core/Engine.js";

export class ControllerSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  createController(Controller) {
    return new Controller(this.engine);
  }

  update() {
    /** @type {Controller[]} */
    const controllerComponents = this.engine.scene.getComponents(Controller);
    for (const controllerComponent of controllerComponents) {
      for (const controller of controllerComponent.controllers) {
        controller.update();
      }
    }
  }
}
