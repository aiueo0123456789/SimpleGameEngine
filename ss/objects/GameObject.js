import { Engine } from "../core/Engine.js";

export class GameObject {
  constructor(id, engine) {
    this.id = id;
    /** @type {"Default" | string} */
    this.layer = "Default";
    /** @type {Engine} */
    this.engine = engine;
    this.components = [];
  }

  setLayer(layer) {
    this.layer = layer;
  }

  addComponent(Component) {
    const component = new Component({ gameObject: this });
    this.components.push(component);
    return component;
  }

  hasComponent(Component) {
    if (this.components.filter((cmp) => cmp instanceof Component).length)
      return true;
    else return false;
  }

  getComponent(Component) {
    for (const cmp of this.components) {
      if (cmp instanceof Component) return cmp;
    }
    return null;
  }
}
