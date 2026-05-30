import { vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";

export class Navigation {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;

    this.target = vec3.create();

    this.arrived = false;
    this.speed = 1;
  }

  setTarget(target) {
    this.arrived = false;
    this.target = target;
  }
}
