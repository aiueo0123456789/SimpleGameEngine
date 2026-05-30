import { InputManager } from "./InputManager";

export class GameInputRouter {
    constructor(data) {
        /** @type {InputManager} */
        this.input = data.input;
    }

    update() {
        if (this.input.inputData.click) {
            
        }
    }
}