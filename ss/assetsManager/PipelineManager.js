import { GPU } from "../utils/webGPU.js";

class ComputePipeline {
  constructor(shader, binds) {
    this.pipeline = GPU.createComputePipeline(GPU.getGroupLayout(""), shader);
    this.binds = [];
  }
}

function extractSetting(shaderCode) {
  const regex = /ShaderSetting\s*\{([\s\S]*?)\}/m;
  const match = shaderCode.match(regex);

  let shaderSetting = {};
  let newShader = shaderCode;

  if (match) {
    const blockContent = match[1]; // { } 内の内容だけ
    newShader = shaderCode.replace(match[0], ""); // 元の文字列からブロック削除

    // ShaderSettingをObjectに
    blockContent.split(",").forEach((line) => {
      const parts = line.split(":").map((s) => s.trim());
      if (parts.length === 2) {
        if (parts[1] == "true") shaderSetting[parts[0]] = true;
        else if (parts[1] == "false") shaderSetting[parts[0]] = false;
        else shaderSetting[parts[0]] = parts[1];
      }
    });
  }
  return { setting: shaderSetting, shaderCode: newShader };
}

function extractBind(shaderCode) {
  const bindStrings = [];

  const newShaderCode = shaderCode.replace(/@bind\((.*?)\);/g, (_, p1) => {
    bindStrings.push(p1.trim());
    return "";
  });

  const result = bindStrings.map((bind) =>
    bind
      .split(/(\s*<\s*|\s*>\s*|\s*:\s*)/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const bindsData = result.map((bindSplit) => {
    return {
      bindName: bindSplit[0] === "<" ? bindSplit[3] : bindSplit[0],
      struct: bindSplit[0] === "<" ? bindSplit[5] : bindSplit[2],
    };
  });
  return {
    shaderCode: newShaderCode,
    binds: bindsData,
    bindStrings: bindStrings,
  };
}

function generateBind(binds) {
  const shaderCode = binds
    .map((bind, index) => `@group(0) @binding(${index}) var ${bind};`)
    .join("\n");
  return { shaderCode: shaderCode };
}

function extractFlagmentOutputs(code) {
  const regex = new RegExp(`struct\\s+FOutput\\s*\\{([\\s\\S]*?)\\}`, "m");

  const match = code.match(regex);
  if (!match) return 0;

  const body = match[1];

  // セミコロンで区切って要素数を数える
  return body
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((x) => GPU.format);
}

function createPipeline(shader, vertexInputs, flagmentOutputs, shaderSetting) {
  const createPipelineObject = {
    layout: "auto",
    vertex: {
      module: shader,
      entryPoint: "vmain",
      buffers: vertexInputs,
    },
    fragment: {
      module: shader,
      entryPoint: "fmain",
      targets: flagmentOutputs.map((format) => {
        return {
          format: format,
          blend: {
            color: {
              srcFactor: "src-alpha", // ソースのアルファ値
              dstFactor: "one-minus-src-alpha", // 1 - ソースのアルファ値
              operation: "add", // 加算
            },
            alpha: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        };
      }),
    },
    depthStencil: {
      format: "depth32float", // 必須: RenderPassで指定された深度フォーマット
      depthWriteEnabled: shaderSetting.depthWrite, // 深度を書き込む場合はtrue
      /**
        "never" 常に不合格（絶対描画されない）
        "less" 新しい方が「手前」なら描画
        "equal" 深度が同じなら描画
        "less-equal" 手前 or 同じなら描画
        "greater" 新しい方が「奥」なら描画
        "not-equal" 深度が違えば描画
        "greater-equal" 奥 or 同じなら描画
        "always" 常に描画（深度無視）
      */
      depthCompare: shaderSetting.depthCompare === "always" ? "always" : "less", // 深度テストの比較方法
    },
    primitive: {
      topology:
        shaderSetting.topologyType === "list"
          ? "triangle-list"
          : "triangle-strip",
      cullMode: shaderSetting.culling ? shaderSetting.culling : "back", // カリング
      // cullMode: "none"   // 両面描画
      // cullMode: "back"   // 背面消す（一般的）
      // cullMode: "front"  // 前面消す
      frontFace: "ccw", // 反時計回りを表面
      // frontFace: "cw", // 時計回りを表面
    },
  };
  console.log("パイプライン作成時のオブジェクト", createPipelineObject);
  return GPU.device.createRenderPipeline(createPipelineObject);
}

/** inputの書き方
{
  vertexBuffers: [
    {location: 0, source: "VERTEX"},
    {location: 1, source: "NORMAL"},
    {location: 2, source: "TANGENT"},
    {location: 2, source: "TEXCOORD"},
  ],
}
 */
export class RenderPipeline {
  constructor(shader, input = { vertexBuffers: [] }) {
    this.vertexBuffers = input.vertexBuffers;

    const settingAnalysisResult = extractSetting(shader);
    this.shaderSetting = settingAnalysisResult.setting;
    const bindsAnalysisResult = extractBind(settingAnalysisResult.shaderCode);
    this.materialProperties = bindsAnalysisResult.binds.map((bind) => bind);
    const generateBindResult = generateBind(bindsAnalysisResult.bindStrings);
    this.shaderCode = `${generateBindResult.shaderCode}\n${bindsAnalysisResult.shaderCode}`;
    this.outputs = extractFlagmentOutputs(this.shaderCode);
    this.shaderModel = GPU.createShaderModule(this.shaderCode);
    this.pipeline = createPipeline(
      this.shaderModel,
      this.vertexBuffers.map((vertexBuffer) => {
        let format = "";
        let byteSize = 0;
        if (vertexBuffer.source == "VERTEX") {
          format = "float32x4";
          byteSize = 4 * 4;
        } else if (vertexBuffer.source == "NORMAL") {
          format = "float32x4";
          byteSize = 4 * 4;
        } else if (vertexBuffer.source == "TANGENT") {
          format = "float32x4";
          byteSize = 4 * 4;
        } else if (vertexBuffer.source == "COLOR") {
          format = "float32x4";
          byteSize = 4 * 4;
        } else if (vertexBuffer.source == "TEXCOORD") {
          format = "float32x2";
          byteSize = 2 * 4;
        } else if (vertexBuffer.source == "TEXCOORD1") {
          format = "float32x2";
          byteSize = 2 * 4;
        } else if (vertexBuffer.source == "TEXCOORD2") {
          format = "float32x2";
          byteSize = 2 * 4;
        } else if (vertexBuffer.source == "TEXCOORD3") {
          format = "float32x2";
          byteSize = 2 * 4;
        } else if (vertexBuffer.source == "TEXCOORD4") {
          format = "float32x2";
          byteSize = 2 * 4;
        } else if (vertexBuffer.source == "TEXCOORD5") {
          format = "float32x2";
          byteSize = 2 * 4;
        }
        return {
          arrayStride: byteSize,
          attributes: [
            {
              shaderLocation: vertexBuffer.location,
              format: format,
              offset: 0,
            },
          ],
        };
      }),
      this.outputs,
      this.shaderSetting,
    );
    this.groupLayout = this.pipeline.getBindGroupLayout(0);
  }
}

export class PipelineManager {
  constructor() {
    this.name = "PipelineManager";
    /** @type {Map<String, Pipeline>} */
    this.pipelines = new Map();
  }

  createComputePipeline(shader, binds) {
    return new ComputePipeline(shader, binds);
  }

  createRenderPipeline(shader, vertexInputs, binds) {
    return new RenderPipeline(shader, vertexInputs, binds);
  }

  /**
   *
   * @param {string} id
   * @returns {RenderPipeline}
   */
  getPipelineById(id) {
    const pipeline = this.pipelines.get(id);
    if (pipeline) return pipeline;
    else return null;
  }

  addPipeline(id, pipeline) {
    this.pipelines.set(id, pipeline);
    return id;
  }
}
