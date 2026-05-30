import { InputManager } from "../manager/InputManager.js";
import { PipelineManager } from "../assetsManager/PipelineManager.js";
import { Scene } from "../scene/Scene.js";
import { AnimationSystem } from "../system/AnimationSystem.js";
import { CameraSystem } from "../system/CameraSystem.js";
import { RenderSystem } from "../system/RenderSystem.js";
import { SkinningSystem } from "../system/SkinningSystem.js";
import { device, format, GPU } from "../utils/webGPU.js";
import { EventSystem } from "../system/EventSystem.js";
import { ControllerSystem } from "../system/ControllerSystem.js";
import { PhysicsSystem } from "../system/PhysicsSystem.js";
import { MeshTransformSystem } from "../system/MeshTransformSystem.js";
import { NavigationSystem } from "../system/NavigationSystem.js";
import { LightSystem } from "../system/LightSystem.js";
import { loadFile } from "../utils/fileLoad.js";
import { GameManager } from "../manager/gameManager.js";
import { MeshInitSystem } from "../system/MeshInitSystem.js";
import { IKSystem } from "../system/IKSystem.js";
import { DynamicBoneSystem } from "../system/DynamicBoneSystem.js";
import { PlaneSystem } from "../system/PlaneSystem.js";
import { Develop } from "../develop/develop.js";

// 型を定義
GPU.addImportSourceStruct(
  await loadFile("./ss/assets/shader/structs/EngineTransform.wgsl"),
);
GPU.addImportSourceStruct(
  await loadFile("./ss/assets/shader/structs/EngineCamera.wgsl"),
);
GPU.addImportSourceStruct(
  await loadFile("./ss/assets/shader/structs/EngineLight.wgsl"),
);
GPU.addImportSourceStruct(
  await loadFile("./ss/assets/shader/structs/EngineFog.wgsl"),
);

GPU.addImportSourceStruct(
  await loadFile("./ss/assets/shader/structs/Principled.wgsl"),
);

// 関数を定義
GPU.addImportSourceFunction(
  await loadFile("./ss/assets/shader/functions/util.wgsl"),
);
GPU.addImportSourceFunction(
  await loadFile("./ss/assets/shader/functions/noise.wgsl"),
);
GPU.addImportSourceFunction(
  await loadFile("./ss/assets/shader/functions/rendering.wgsl"),
);

GPU.addImportSourceFunction(
  await loadFile("./ss/assets/shader/functions/principledBSDF.wgsl"),
);

export class Engine {
  constructor() {
    this.scene = new Scene(this);
    this.develop = new Develop(this);
    this.systems = [
      new EventSystem(this),
      new ControllerSystem(this),
      new NavigationSystem(this),
      new PlaneSystem(this),
      new PhysicsSystem(this),
      new AnimationSystem(this),
      new IKSystem(this),
      new DynamicBoneSystem(this),
      new MeshInitSystem(this),
      new SkinningSystem(this),
      new MeshTransformSystem(this),
      new CameraSystem(this),
      new LightSystem(this),
      new RenderSystem(this),
    ];
    this.managers = [new InputManager(this), new GameManager(this)];
    this.assetsManagers = [];

    this.renderTarget = document.createElement("canvas");
    document.body.append(this.renderTarget);
    this.renderTargetContext = this.renderTarget.getContext("webgpu");
    this.renderTargetContext.configure({
      device: device,
      format: format,
    });

    this._startTime = Date.now() / 1000; // 秒
  }

  get time() {
    return Date.now() / 1000 - this._startTime; // 秒
  }

  get deltaTime() {
    return 1 / 60;
  }

  addAssetsManager(Manager) {
    const assetsManager = new Manager(this);
    this.assetsManagers.push(assetsManager);
    return assetsManager;
  }

  getSystem(System) {
    for (const system of this.systems) {
      if (system instanceof System) return system;
    }
    return null;
  }

  getManager(Manager) {
    for (const manager of this.managers) {
      if (manager instanceof Manager) return manager;
    }
    return null;
  }

  getAssetsManager(AssetsManager) {
    for (const assetsManager of this.assetsManagers) {
      if (assetsManager instanceof AssetsManager) return assetsManager;
    }
    return null;
  }

  start() {
    for (const manager of this.managers) {
      if (manager.start) manager.start();
    }

    for (const system of this.systems) {
      if (system.start) system.start();
    }
  }

  update() {
    for (const manager of this.managers) {
      if (manager.update) manager.update();
    }

    for (const system of this.systems) {
      if (system.update) system.update();
    }

    for (const manager of this.managers) {
      if (manager.updateLate) manager.updateLate();
    }
  }
}
