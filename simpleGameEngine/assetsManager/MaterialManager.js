import { GPU } from "../utils/webGPU.js";
import { RenderPipeline } from "./PipelineManager.js";

class GPUDataManager {
  constructor() {
    this.group = null;
  }

  update(/** @type {Material} */ material) {
    const items = [];

    const setSource = (s) => {
      let v = null;
      if (s instanceof GPUTexture) v = s.createView();
      else if (s instanceof GPUTextureView) v = s;
      else if (s instanceof GPUSampler) v = s;
      else if (s instanceof GPUBuffer) v = s;
      else return ;
      items.push(v);
    };

    for (const property of material.pipeline.materialProperties) {
      // bindの順番で取り出し
      const source = material.properties[property.bindName];
      if (!source) {
        console.error("プロパティが不足しています");
        return ;
      }
      if (source instanceof DynamicProperty && source.source)
        setSource(source.source);
      else setSource(source);
    }
    // console.log("マテリアルGPUデータの完成", items);
    material.gpu.group = GPU.createGroup(material.pipeline.groupLayout, items);
  }
}

class DynamicProperty {
  constructor() {
    this.sourcePath = "";
    this.source = null;
  }

  setSourcePath(sourcePath) {
    this.sourcePath = sourcePath;
  }

  setSource(source) {
    this.source = source;
  }
}

export class Material {
  static createDynamicProperty() {
    return new DynamicProperty();
  }
  constructor(pipeline) {
    this.name = "";
    /** @type {RenderPipeline} */
    this.pipeline = pipeline;
    this.properties = {};
    this.gpu = new GPUDataManager();
  }

  setName(name) {
    this.name = name;
  }

  hasDynamicProperty() {
    for (const property of Object.keys(this.properties)) {
      if (this.properties[property] instanceof DynamicProperty) return true;
    }
    return false;
  }

  getDynamicProperies() {
    const result = [];
    for (const property of Object.keys(this.properties)) {
      if (this.properties[property] instanceof DynamicProperty)
        result.push(this.properties[property]);
    }
    return result;
  }

  gpuUpdate() {
    this.gpu.update(this);
  }

  setProperty(property, source) {
    if (
      this.pipeline.materialProperties.filter((p) => p.bindName == property)
    ) {
      this.properties[property] = source;
      this.gpuUpdate();
    } else {
      console.error(`このマテリアルに${property}は使用できません`, this);
    }
  }

  getProperty(property) {
    if (property in this.properties) {
      return this.properties[property];
    }
    console.error(`プロパティ ${property} は存在しません`);
    return null;
  }
}

export class MaterialManager {
  constructor() {
    this.name = "MaterialManager";
    /** @type {Map<String, Material>} */
    this.materials = new Map();
  }

  createMaterial(pipeline) {
    return new Material(pipeline);
  }

  getMaterialById(id) {
    const material = this.materials.get(id);
    if (material) return material;
    else return null;
  }

  addMaterial(id, material) {
    console.log(material);
    this.materials.set(id, material);
    return id;
  }
}
