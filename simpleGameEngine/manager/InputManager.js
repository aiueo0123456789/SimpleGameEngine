import { vec2 } from "../../webgpuMatrix.js";
import { Engine } from "../core/Engine.js";

class InputData {
    constructor() {
        this.click = false;
        this.clickPosition = vec2.create();
    }
}

export class InputManager {
    constructor(engine) {
        /** @type {Engine} */
        this.engine = engine;

        this.downKeys = {};
        this.inputData = new InputData();
        this.mousePosition = vec2.create();
        this.mouseMovement = vec2.create();
        this.current = {};
        this.previous = {};
        this.mouseScrollDelta = vec2.create();
    }

    start() {
        window.addEventListener("mousedown", (e) => {
            this.setKey("Mouse0", true);
            vec2.set(e.clientX, e.clientY, this.mousePosition);
        });
        window.addEventListener("mouseup", (e) => {
            this.setKey("Mouse0", false);
            vec2.set(e.clientX, e.clientY, this.mousePosition);
        });
        window.addEventListener("mousemove", (e) => {
            vec2.set(e.clientX, e.clientY, this.mousePosition);
            vec2.set(e.movementX, e.movementY, this.mouseMovement);
        });
        window.addEventListener("keydown", (e) => {
            console.log(e.code)
            this.setKey(e.code, true);
        });
        window.addEventListener("keyup", (e) => {
            this.setKey(e.code, false);
        });
        window.addEventListener("wheel", (e) => {
            vec2.set(e.deltaX, e.deltaY, this.mouseScrollDelta);
        });
        this.update();
    }

    update() {
    }

    updateLate() {
        // 前フレーム保存
        this.previous = {};
        for (const key in this.current) {
            this.previous[key] = this.current[key];
        }
        this.mouseScrollDelta[0] = 0;
        this.mouseScrollDelta[1] = 0;
        this.mouseMovement[0] = 0;
        this.mouseMovement[1] = 0;
    }

    setKey(key, value) {
        this.current[key] = value;
    }

    getKey(key) {
        return !!this.current[key];
    }

    getKeyDown(key) {
        return this.current[key] && !this.previous[key];
    }

    getKeyUp(key) {
        return !this.current[key] && this.previous[key];
    }
}