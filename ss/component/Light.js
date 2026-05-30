import { mat4, vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";
import { GPU } from "../utils/webGPU.js";
import { Transform } from "./Transform.js";

class Projection {
  constructor() {
    this.projection = true; // 遠近法を再現するか
    // this.projection = false; // 遠近法を再現するか
    // this.projection = false; // 遠近法を再現するか
    this.fieldOfViewAxis = "Vertical"; // "Horizontal"
    this.fieldOfView = 90; // 視野角
    this.clippingNear = 0.1;
    this.clippingFar = 100;
    this.lookAt = null;
  }
}

class GPUDataManager {
  constructor() {
    this.configOffset = 0; // 4 + 4 + 4 + 4
    this.transformOffset = 16; // 4 * 4 + 4 * 4 + 4 * 4
    this.pMOffset = this.transformOffset + 16 * 4;
    this.vMOffset = this.pMOffset + 64;
    this.vpMOffset = this.vMOffset + 64;
    this.ivpMOffset = this.vpMOffset + 64;
    this.colorOffset = this.ivpMOffset + 64;
    this.intensityOffset = this.colorOffset + 12;
    this.lightBuffer = GPU.createBuffer(this.intensityOffset + 4, ["u"]);
  }
}

class Rendering {
  constructor() {
    this.renderTrigger = "always"; // "always": 常に描画 | "active": "アクティブ中常に描画"
    // this.renderTarget = GPU.createTexture2D(this.rendering.renderingSize);
    this.renderTarget = "renderTexture";
    /** @type {Number[]} */
    this.renderingSize = [1400, 820];
    this.renderScale = 2;
    /** @type {Boolean} */
    this.usingDepth = true;
    /** @type {Boolean} */
    this.outputNormal = true;
    /** @type {Boolean} */
    this.renderShadows = true;
    this.backGround = [0.3, 0.4, 0.7, 1];
  }
}

class Matrices {
  constructor() {
    this.lightM = mat4.create();
    this.pM = mat4.create();
    this.vM = mat4.create();
    this.vpM = mat4.create();
    this.ivpM = mat4.create();
  }
}

export class Light {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    this.color = [1, 1, 1];
    this.intensity = 1;

    this.rendering = new Rendering();
    this.projection = new Projection();
    this.gpu = new GPUDataManager();
    this.matrices = new Matrices();
  }

  // カメラ行列の更新
  updateMatrix(/** @type {Transform} */ transform) {
    const pos = transform.position;
    const rot = transform.rotation;
    mat4.identity(this.matrices.pM);
    mat4.identity(this.matrices.lightM);
    // カメラ行列の計算
    if (this.projection.lookAt) {
      mat4.lookAt(pos, this.projection.lookAt, [0, 1, 0], this.matrices.vM);
    } else {
      mat4.translate(this.matrices.lightM, pos, this.matrices.lightM);
      mat4.rotateY(this.matrices.lightM, rot[1], this.matrices.lightM);
      mat4.rotateX(this.matrices.lightM, rot[0], this.matrices.lightM);
      mat4.rotateZ(this.matrices.lightM, rot[2], this.matrices.lightM);
      // 逆行列でview
      mat4.inverse(this.matrices.lightM, this.matrices.vM);
    }
    // projの計算
    const aspect =
      this.rendering.renderingSize[0] / this.rendering.renderingSize[1];
    if (this.projection.projection) {
      const fov = (this.projection.fieldOfView * Math.PI) / 180;
      if (this.projection.fieldOfViewAxis === "Vertical") {
        mat4.perspective(
          fov,
          aspect,
          this.projection.clippingNear,
          this.projection.clippingFar,
          this.matrices.pM,
        );
      } else {
        const vFov = 2 * Math.atan(Math.tan(fov / 2) / aspect);
        mat4.perspective(
          vFov,
          aspect,
          this.projection.clippingNear,
          this.projection.clippingFar,
          this.matrices.pM,
        );
      }
    } else {
      const size = 8;
      mat4.ortho(
        -size * aspect,
        size * aspect,
        -size,
        size,
        this.projection.clippingNear,
        this.projection.clippingFar,
        this.matrices.pM,
      );
    }

    // --- VP 計算 ---
    mat4.multiply(this.matrices.pM, this.matrices.vM, this.matrices.vpM); // vp = proj * view

    // --- 逆行列 ---
    mat4.inverse(this.matrices.vpM, this.matrices.ivpM);
    GPU.writeBuffer(this.gpu.lightBuffer, this.matrices.pM, this.gpu.pMOffset);
    GPU.writeBuffer(this.gpu.lightBuffer, this.matrices.vM, this.gpu.vMOffset);
    GPU.writeBuffer(
      this.gpu.lightBuffer,
      this.matrices.vpM,
      this.gpu.vpMOffset,
    );
    GPU.writeBuffer(
      this.gpu.lightBuffer,
      this.matrices.ivpM,
      this.gpu.ivpMOffset,
    );
    GPU.writeBuffer(
      this.gpu.lightBuffer,
      // transform.getWorldForward(),
      GPU.createBitData(vec3.normalize([0, -1, 1]), ["f32"]),
      this.gpu.transformOffset + 4 * 4 * 3,
    );
    GPU.writeBuffer(
      this.gpu.lightBuffer,
      GPU.createBitData(this.color, ["f32"]),
      this.gpu.colorOffset,
    );
    GPU.writeBuffer(
      this.gpu.lightBuffer,
      GPU.createBitData([this.intensity], ["f32"]),
      this.gpu.intensityOffset,
    );
  }
}
