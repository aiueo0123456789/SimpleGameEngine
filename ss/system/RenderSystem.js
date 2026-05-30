import { Camera } from "../component/camera.js";
import { MeshRenderer } from "../component/MeshRenderer.js";
import { Engine } from "../core/Engine.js";
import { Material } from "../assetsManager/MaterialManager.js";
import {
  PipelineManager,
  RenderPipeline,
} from "../assetsManager/PipelineManager.js";
import { device, GPU } from "../utils/webGPU.js";
import { Gizmo_Triangle } from "../develop/Gizmo/shape/Gizmo_Triangle.js";
import { BoneRenderer } from "../component/BoneRenderer.js";

export class RenderSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
  }

  renderCamera(/** @type {Camera} */ camera) {
    const renderingGameObjects = camera.cullingMask
      .map((mask) => this.engine.scene.getLayer(mask))
      .flat();
    /** @type {PipelineManager} */
    const pipelineManager = this.engine.getAssetsManager(PipelineManager);
    const commandEncoder = device.createCommandEncoder();
    const textureSize = [
      camera.rendering.renderingSize[0] * camera.rendering.renderScale,
      camera.rendering.renderingSize[1] * camera.rendering.renderScale,
    ];

    const textureMap = {};

    let renderTarget = camera.rendering.renderTarget;
    if (renderTarget === "renderTexture") {
      this.engine.renderTarget.width = textureSize[0];
      this.engine.renderTarget.height = textureSize[1];
      this.engine.renderTarget.style.width = `${camera.rendering.renderingSize[0]}px`;
      this.engine.renderTarget.style.height = `${camera.rendering.renderingSize[1]}px`;
      renderTarget = this.engine.renderTargetContext.getCurrentTexture();
    }
    let renderTargetView = renderTarget.createView();

    let colorTexture = null;
    let colorTextureView = null;

    let normalTexture = null;
    let normalTextureView = null;

    let depthTexture = null;
    let depthTextureView = null;

    colorTexture = GPU.createTexture2D(textureSize, "bgra8unorm");
    colorTextureView = colorTexture.createView();

    normalTexture = GPU.createTexture2D(textureSize, "bgra8unorm");
    normalTextureView = normalTexture.createView();

    depthTexture = GPU.createDepthTexture2D(textureSize);
    depthTextureView = depthTexture.createView();

    let lastRenderTargetView = null;
    const changeLastRenderTargetView = (renderTarget) => {
      lastRenderTargetView = renderTarget;
    };

    // レンダーパスの生成に必要なデータを作る
    let renderPassObject = {};

    const resetRenderPassObject = () => {
      renderPassObject = {
        colorAttachments: [],
      };
    };
    const setRenderTargetToRenderPassObject = (
      renderTargetView,
      init = false,
    ) => {
      if (init) {
        renderPassObject.colorAttachments.push({
          view: renderTargetView,
          clearValue: camera.rendering.backGround,
          loadOp: "clear",
          storeOp: "store",
        });
      } else {
        renderPassObject.colorAttachments.push({
          view: renderTargetView,
          loadOp: "load",
          storeOp: "store",
        });
      }
    };
    const setNormalToRenderPassObject = (init = false) => {
      if (init) {
        renderPassObject.colorAttachments.push({
          view: normalTextureView,
          clearValue: [0, 0, 0, 1],
          loadOp: "clear",
          storeOp: "store",
        });
      } else {
        renderPassObject.colorAttachments.push({
          view: normalTextureView,
          loadOp: "load",
          storeOp: "store",
        });
      }
    };
    const setDepthToRenderPassObject = (init = false) => {
      if (init) {
        renderPassObject.depthStencilAttachment = {
          view: depthTextureView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        };
      } else {
        renderPassObject.depthStencilAttachment = {
          view: depthTextureView,
          depthLoadOp: "load",
          depthStoreOp: "store",
        };
      }
    };
    resetRenderPassObject();
    setRenderTargetToRenderPassObject(colorTextureView, true);
    setDepthToRenderPassObject(true);

    if (this.engine.scene.rendering.skybox.use) {
      const skyboxRenderPass = commandEncoder.beginRenderPass(renderPassObject);
      const skyboxGroup = GPU.createGroup(
        pipelineManager.getPipelineById("skybox").groupLayout,
        [
          camera.gpu.cameraBuffer,
          GPU.sampler,
          {
            item: this.engine.scene.rendering.skybox.gpu.textureView,
            type: "ct",
          },
        ],
      );
      skyboxRenderPass.setPipeline(
        pipelineManager.getPipelineById("skybox").pipeline,
      );
      skyboxRenderPass.setBindGroup(0, skyboxGroup);
      skyboxRenderPass.draw(3, 1, 0, 0);
      skyboxRenderPass.end();

      resetRenderPassObject();
      setRenderTargetToRenderPassObject(colorTextureView);
      setDepthToRenderPassObject(true);
    }

    setNormalToRenderPassObject(true);
    const mainRenderPass = commandEncoder.beginRenderPass(renderPassObject);

    const draw = (renderPass, mr, subMesh, pipeline, material) => {
      renderPass.setPipeline(pipeline.pipeline);
      renderPass.setBindGroup(0, material.gpu.group);
      for (const data of pipeline.vertexBuffers) {
        /** @type {string} */
        const source = data.source;
        if (source == "VERTEX") {
          renderPass.setVertexBuffer(data.location, mr.gpu.verticesBuffer);
        } else if (source == "NORMAL") {
          renderPass.setVertexBuffer(data.location, mr.gpu.normalsBuffer);
        } else if (source == "TANGENT") {
          renderPass.setVertexBuffer(data.location, mr.gpu.tangentsBuffer);
        } else if (source == "COLOR") {
          renderPass.setVertexBuffer(data.location, mr.gpu.colorsBuffer);
        } else if (source == "TEXCOORD") {
          renderPass.setVertexBuffer(
            data.location,
            mr.gpu.texCoordsBufferLayers[0],
          );
          // GPU.printBufferData(mr.gpu.texCoordsBufferLayers[0], ["f32", "f32"], "uv");
        } else if (source.startsWith("TEXCOORD")) {
          const layerIndex = Number(source.slice("TEXCOORD".length));
          if (layerIndex < mr.gpu.texCoordsBufferLayers.length) {
            renderPass.setVertexBuffer(
              data.location,
              mr.gpu.texCoordsBufferLayers[layerIndex],
            );
          } else {
            console.error(
              "texCoordsのレイヤー番号が用意されたバッファの数を超えています",
            );
          }
        }
      }
      renderPass.setIndexBuffer(mr.gpu.trianglesBuffer, "uint32");
      renderPass.drawIndexed(subMesh.count, 1, subMesh.offset);
    };

    const isolateList = []; // デプステクスチャなどを使う場合レンダーパスごと分ける
    const putOffList = []; // 半透明物体を後で描画
    /** @type {MeshRenderer[]} */
    const mrList = this.engine.scene.getComponents(
      MeshRenderer,
      renderingGameObjects,
    );
    for (const mr of mrList) {
      for (const subMesh of mr.subMeshes) {
        /** @type {Material} */
        const material = subMesh.material;
        /** @type {RenderPipeline} */
        const pipeline = material.pipeline;
        if (pipeline.shaderSetting.useDepthTexture) {
          isolateList.push({ mr, subMesh, pipeline, material });
          continue;
        }
        if (pipeline.shaderSetting.alpha) {
          putOffList.push({ mr, subMesh, pipeline, material });
          continue;
        }
        draw(mainRenderPass, mr, subMesh, pipeline, material);
      }
    }

    for (const putOff of putOffList) {
      draw(
        mainRenderPass,
        putOff.mr,
        putOff.subMesh,
        putOff.pipeline,
        putOff.material,
      );
    }

    mainRenderPass.end();

    if (isolateList.length) {
      const colorCopyTexture = GPU.createTexture2D(textureSize, "bgra8unorm");
      commandEncoder.copyTextureToTexture(
        { texture: colorTexture },
        { texture: colorCopyTexture },
        textureSize,
      );
      const colorCopyTextureView = colorCopyTexture.createView();
      textureMap["color"] = colorCopyTextureView;
      const depthCopyTexture = GPU.createDepthTexture2D(textureSize);
      commandEncoder.copyTextureToTexture(
        { texture: depthTexture },
        { texture: depthCopyTexture },
        textureSize,
      );
      const depthCopyTextureView = depthCopyTexture.createView();
      textureMap["depth"] = depthCopyTextureView;
      resetRenderPassObject();
      setRenderTargetToRenderPassObject(colorTextureView);
      setNormalToRenderPassObject();
      setDepthToRenderPassObject();
      const subRenderPass = commandEncoder.beginRenderPass(renderPassObject);
      for (const isolate of isolateList) {
        if (isolate.material.hasDynamicProperty()) {
          for (const dynamicProperty of isolate.material.getDynamicProperies()) {
            dynamicProperty.setSource(textureMap[dynamicProperty.sourcePath]);
          }
          isolate.material.gpuUpdate();
        }
        draw(
          subRenderPass,
          isolate.mr,
          isolate.subMesh,
          isolate.pipeline,
          isolate.material,
        );
      }
      subRenderPass.end();
    }

    textureMap["color"] = colorTextureView;
    changeLastRenderTargetView(colorTextureView);

    if (camera.rendering.postprocesses.length) {
      // ポストプロセスを適用
      for (const postprocess of camera.rendering.postprocesses) {
        if (
          !postprocess.outputTexture ||
          textureSize[0] != postprocess.outputTexture.width ||
          textureSize[1] != postprocess.outputTexture.height
        ) {
          // 更新が必要な時だけ更新
          postprocess.outputTexture = GPU.createTexture2D(
            textureSize,
            "bgra8unorm",
          );
          postprocess.outputTextureView =
            postprocess.outputTexture.createView();
        }
        if (postprocess.material.hasDynamicProperty()) {
          for (const dynamicProperty of postprocess.material.getDynamicProperies()) {
            dynamicProperty.setSource(textureMap[dynamicProperty.sourcePath]);
          }
          postprocess.material.gpuUpdate();
        }
        resetRenderPassObject();
        setRenderTargetToRenderPassObject(postprocess.outputTextureView);
        setDepthToRenderPassObject();
        const PostProcessingPass =
          commandEncoder.beginRenderPass(renderPassObject);
        PostProcessingPass.setPipeline(postprocess.pipeline.pipeline);
        PostProcessingPass.setBindGroup(0, postprocess.material.gpu.group);
        PostProcessingPass.draw(4, 1, 0, 0);
        PostProcessingPass.end();
        textureMap[postprocess.localId] = postprocess.outputTextureView;
        changeLastRenderTargetView(postprocess.outputTextureView);
      }
    }

    resetRenderPassObject();
    setRenderTargetToRenderPassObject(lastRenderTargetView);
    setDepthToRenderPassObject();
    const gizmoRenderPass = commandEncoder.beginRenderPass(renderPassObject);
    for (const gizmo of this.engine.develop.gizmos) {
      for (const shape of gizmo.shapes) {
        if (shape instanceof Gizmo_Triangle) {
          const pipeline = pipelineManager.getPipelineById("gizmo_triangle");
          gizmoRenderPass.setPipeline(pipeline.pipeline);
          gizmoRenderPass.setBindGroup(
            0,
            GPU.createGroup(pipeline.groupLayout, [
              camera.gpu.cameraBuffer,
              shape.gpu.colorBuffer,
            ]),
          );
          gizmoRenderPass.setVertexBuffer(0, shape.gpu.verticesBuffer);
          gizmoRenderPass.draw(3, 1, 0, 0);
        }
      }
    }

    /** @type {BoneRenderer[]} */
    const boneRendererList = this.engine.scene.getComponents(
      BoneRenderer,
      renderingGameObjects,
    );
    for (const boneRenderer of boneRendererList) {
      boneRenderer.updateArmature();
      const pipeline = pipelineManager.getPipelineById("gizmo_bone");
      gizmoRenderPass.setPipeline(pipeline.pipeline);
      gizmoRenderPass.setBindGroup(
        0,
        GPU.createGroup(pipeline.groupLayout, [
          camera.gpu.cameraBuffer,
          boneRenderer.gpu.boneBuffer,
        ]),
      );
      gizmoRenderPass.draw(6, boneRenderer.bonesNum, 0, 0);
    }
    gizmoRenderPass.end();

    // テクスチャをレンダリングターゲットにコピー
    resetRenderPassObject();
    setRenderTargetToRenderPassObject(renderTargetView);
    setDepthToRenderPassObject();
    const canvasRenderPass = commandEncoder.beginRenderPass(renderPassObject);
    canvasRenderPass.setBindGroup(
      0,
      GPU.createGroup(
        pipelineManager.getPipelineById("canvasRender").groupLayout,
        [GPU.sampler, lastRenderTargetView],
        // [GPU.sampler, normalTextureView],
      ),
    );
    canvasRenderPass.setPipeline(
      pipelineManager.getPipelineById("canvasRender").pipeline,
    );
    canvasRenderPass.draw(4, 1, 0, 0);

    canvasRenderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    for (const key in textureMap) {
      textureMap[key] = null;
    }
  }

  update() {
    const cameras = this.engine.scene.getComponents(Camera);

    for (const camera of cameras) {
      this.renderCamera(camera);
    }
  }
}
