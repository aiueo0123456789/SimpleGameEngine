import { vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";

export class BoxCollider {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    this.size = vec3.create();
    this.center = vec3.create();
  }

  setCenter(center) {
    vec3.copy(center, this.center);
  }

  setSize(size) {
    vec3.copy(size, this.size);
  }
}
