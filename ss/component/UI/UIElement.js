import { vec2 } from "../../../webgpuMatrix.js";

export class UIElement {
  constructor() {
    /** @type {UIElement | null} */
    this.parent = null;
    /** @type {UIElement[]} */
    this.children = [];
    this.texture = null;
    this.position = vec2.create();
    this.size = vec2.create();
    this.rotation = 0;
  }
}
