import { Engine } from "../core/Engine.js";

export class Application {
    constructor() {
        this.engine = new Engine();
    }

    start() {
        this.engine.start();
    }

    update() {
        this.engine.update();
    }
}