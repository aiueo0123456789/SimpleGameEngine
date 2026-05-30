import { Engine } from "../core/Engine.js";

export class EventSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
    this.events = new Map();
    this.eventNames = ["onClick"];
  }

  // ポインターがゲームではなくUIか
  isPointerOverGameObject() {
    return "game";
  }

  addEvent(target, event, fn) {
    if (!this.events.has(target)) this.events.set(target, new Map());
    const targetEvents = this.events.get(target);
    if (this.eventNames.includes(event) && !targetEvents.has(event))
      targetEvents.set(event, []);
    targetEvents.get(event).push(fn);
  }
}
