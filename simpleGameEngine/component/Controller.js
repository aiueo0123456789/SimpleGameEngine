import { GameObject } from "../objects/GameObject.js";

export class Controller {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    this.controllers = [];
  }

  addController(controller) {
    this.controllers.push(controller);
  }
}
