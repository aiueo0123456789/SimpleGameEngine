import { GameObject } from "../objects/GameObject.js";
import { createID } from "../utils/createID.js";
import { Fog } from "./Rendering/Fog.js";
import { Skybox } from "./Rendering/Skybox.js";

class Rendering {
  constructor() {
    this.fog = new Fog();
    this.skybox = new Skybox();
  }
}

export class Scene {
  constructor(engine) {
    this.engine = engine;
    /** @type {GameObject[]} */
    this.gameObjects = [];
    this.rendering = new Rendering();
  }

  /**
   * レイヤーのGameObjectの配列を返す
   * @param {"Default" | string} layer
   * @returns {GameObject[]}
   */
  getLayer(layer) {
    return this.gameObjects.filter((gameObject) => gameObject.layer == layer);
  }

  /**
   * 新しいGameObjectを作る
   * @param {string} id
   * @returns {GameObject}
   */
  createGameObject(id = createID()) {
    return new GameObject(id, this.engine);
  }

  /**
   * GameObjectをsceneに追加
   * @param {GameObject} gameObject
   * @returns {GameObject | null}
   */
  addGameObjecet(gameObject) {
    if (gameObject instanceof GameObject) {
      this.gameObjects.push(gameObject);
      return gameObject;
    } else {
      return null;
    }
  }

  removeGameObject(gameObject) {
    if (this.gameObjects.includes(gameObject)) {
      this.gameObjects.splice(this.gameObjects.indexOf(gameObject));
      return true;
    } else {
      return false;
    }
  }

  /**
   * 指定したコンポーネントをGameObjectsから探します
   * @param {*} Component
   * @param {GameObject[]} gameObjects
   * @returns {Object[]}
   */
  getComponents(Component, gameObjects = this.gameObjects) {
    const result = [];
    for (const obj of gameObjects) {
      const component = obj.getComponent(Component);
      if (component) {
        result.push(component);
      }
    }
    return result;
  }

  /**
   * idからGameObjectを探します
   * @param {string} id
   * @returns {GameObject | null}
   */
  getObjectByID(id) {
    for (const gameObject of this.gameObjects) {
      if (gameObject.id === id) return gameObject;
    }
    return null;
  }
}
