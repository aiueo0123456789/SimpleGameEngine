import { mat4, vec2, vec3, vec4 } from "../../webgpuMatrix.js";
import { Material } from "../assetsManager/MaterialManager.js";
import { RenderPipeline } from "../assetsManager/PipelineManager.js";
import { GameObject } from "../objects/GameObject.js";
import { createID } from "../utils/createID.js";
import { GPU } from "../utils/webGPU.js";

class Projection {
  constructor() {
    this.projection = true; // 遠近法を再現するか
    // this.projection = false; // 遠近法を再現するか
    // this.projection = false; // 遠近法を再現するか
    this.fieldOfViewAxis = "Vertical"; // "Horizontal"
    this.fieldOfView = 90; // 視野角
    this.clippingNear = 0.1;
    this.clippingFar = 400;
    this.lookAt = null;
  }
}

class GPUDataManager {
  constructor() {
    `struct Transform {
      position: vec4<f32>,
      rotation: vec4<f32>,
      scale: vec4<f32>,
    }
    struct Config {
      near: f32,
      far: f32,
      padding: f32,
      padding_: f32,
      dir: vec4<f32>,
    }
    struct Camera {
      config: Config,
      transform: Transform,
      pM: mat4x4<f32>,
      vM: mat4x4<f32>,
      vpM: mat4x4<f32>,
      ivpM: mat4x4<f32>,
      dir: vec3<f32>,
      dirPadding: f32,
    }`;

    this.configOffset = 0; // 4 + 4 + 4 + 4
    this.transformOffset = 16; // 4 * 4 + 4 * 4 + 4 * 4
    this.pMOffset = this.transformOffset + 4 * 4 * 4;
    this.vMOffset = this.pMOffset + 64;
    this.vpMOffset = this.vMOffset + 64;
    this.ivpMOffset = this.vpMOffset + 64;
    this.bufferSize = this.ivpMOffset + 64;
    this.cameraBuffer = GPU.createBuffer(this.bufferSize, ["u"]);
  }
}

class Matrices {
  constructor() {
    this.cameraM = mat4.create();
    this.pM = mat4.create();
    this.vM = mat4.create();
    this.vpM = mat4.create();
    this.ivpM = mat4.create();
  }
}

class Postprocess {
  constructor() {
    /** @type {RenderPipeline} */
    this.pipeline = null;
    /** @type {Material} */
    this.material = null;
    this.localId = createID(); // レンダーパスないのid
    this.outputTexture = null;
    this.outputTextureView = null;
  }

  setPipeline(pipeline) {
    this.pipeline = pipeline;
  }

  setMaterial(material) {
    this.material = material;
  }
}

class Rendering {
  createPostprocess() {
    return new Postprocess();
  }

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
    /** @type {Postprocess[]} */
    this.postprocesses = [];
    this.backGround = [1, 0, 1, 1];
    // this.backGround = [0.943 * 0.8, 0.855 * 0.8, 0.769 * 0.8, 1];
  }

  appendPostprocesses(/** @type {Postprocess} */ postprocess) {
    if (postprocess instanceof Postprocess) {
      this.postprocesses.push(postprocess);
    } else {
      console.error("Postprocess型である必要があります", postprocess);
    }
  }
}

export class Camera {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    /** @type {string[]} */
    this.cullingMask = ["Default"];
    this.projection = new Projection();
    this.gpu = new GPUDataManager();
    this.matrices = new Matrices();
    this.rendering = new Rendering();
  }

  removeCullingMask(layer) {
    this.cullingMask.splice(this.cullingMask.indexOf(layer), 1);
  }

  addCullingMask(layer) {
    this.cullingMask.push(layer);
  }

  setLookAt(position) {
    if (!position) {
      this.projection.lookAt = null;
      return;
    }
    if (!this.projection.lookAt) this.projection.lookAt = vec3.create();
    this.projection.lookAt[0] = position[0];
    this.projection.lookAt[1] = position[1];
    this.projection.lookAt[2] = position[2];
  }

  screenPointToRay(screenPoint, renderingSize = this.rendering.renderingSize) {
    // スクリーン座標 → NDC [-1, 1]
    const ndcX = (screenPoint[0] / renderingSize[0]) * 2.0 - 1.0;
    const ndcY = -(screenPoint[1] / renderingSize[1]) * 2.0 + 1.0; // Y軸反転
    // ニアプレーン上の点（NDC Z = -1）
    const nearClip = vec4.transformMat4(
      [ndcX, ndcY, -1.0, 1.0],
      this.matrices.ivpM,
    );
    // ファープレーン上の点（NDC Z = 1）
    const farClip = vec4.transformMat4(
      [ndcX, ndcY, 1.0, 1.0],
      this.matrices.ivpM,
    );
    // w除算でワールド座標へ
    const nearWorld = vec3.scale(nearClip.slice(0, 3), 1.0 / nearClip[3]);
    const farWorld = vec3.scale(farClip.slice(0, 3), 1.0 / farClip[3]);
    // レイ方向
    const direction = vec3.normalize(vec3.sub(farWorld, nearWorld));
    return {
      origin: nearWorld, // ニアプレーン上の点を原点に
      direction: direction,
    };
  }

  // カメラ行列の更新
  updateMatrix(transform) {
    const pos = transform.position;
    const rot = transform.rotation;
    mat4.identity(this.matrices.pM);
    mat4.identity(this.matrices.cameraM);
    // カメラ行列の計算
    if (this.projection.lookAt) {
      mat4.lookAt(pos, this.projection.lookAt, [0, 1, 0], this.matrices.vM);
    } else {
      // クォータニオン → 回転行列
      const rotMat = mat4.fromQuat(rot); // rot はクォータニオン [x,y,z,w]

      // cameraM = T * R（ワールド行列）
      mat4.identity(this.matrices.cameraM);
      mat4.translate(this.matrices.cameraM, pos, this.matrices.cameraM);
      mat4.multiply(this.matrices.cameraM, rotMat, this.matrices.cameraM);

      // ビュー行列 = cameraM の逆行列
      mat4.inverse(this.matrices.cameraM, this.matrices.vM);
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
    GPU.writeBuffer(
      this.gpu.cameraBuffer,
      transform.position,
      this.gpu.transformOffset,
    );
    GPU.writeBuffer(
      this.gpu.cameraBuffer,
      transform.rotation,
      this.gpu.transformOffset + 4 * 4,
    );
    GPU.writeBuffer(
      this.gpu.cameraBuffer,
      transform.scale,
      this.gpu.transformOffset + 4 * 4 * 2,
    );
    GPU.writeBuffer(
      this.gpu.cameraBuffer,
      transform.getWorldForward(),
      this.gpu.transformOffset + 4 * 4 * 3,
    );
    // config
    GPU.writeBuffer(
      this.gpu.cameraBuffer,
      new Float32Array([
        this.projection.clippingNear,
        this.projection.clippingFar,
      ]),
      this.gpu.configOffset,
    );
    // matrix
    GPU.writeBuffer(this.gpu.cameraBuffer, this.matrices.pM, this.gpu.pMOffset);
    GPU.writeBuffer(this.gpu.cameraBuffer, this.matrices.vM, this.gpu.vMOffset);
    GPU.writeBuffer(
      this.gpu.cameraBuffer,
      this.matrices.vpM,
      this.gpu.vpMOffset,
    );
    GPU.writeBuffer(
      this.gpu.cameraBuffer,
      this.matrices.ivpM,
      this.gpu.ivpMOffset,
    );
  }
}
