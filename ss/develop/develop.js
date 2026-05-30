import { Engine } from "../core/Engine.js";
import { Gizmo } from "./Gizmo/Gizmo.js";

export class Develop {
  constructor(engine) {
    /** @type {Engine} */
    this.engine = engine;

    this.gizmos = [];
  }

  createGizmo() {
    return new Gizmo();
  }

  appendGizmo(gizmo) {
    this.gizmos.push(gizmo);
  }
}