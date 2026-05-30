import { Material } from "../assetsManager/MaterialManager.js";
import { GameObject } from "../objects/GameObject.js";
import { GPU } from "../utils/webGPU.js";
import { Mesh } from "./Mesh.js";

class GPUDataManager {
  constructor() {
    this.verticesBuffer = null;
    this.normalsBuffer = null;
    this.tangentsBuffer = null;
    this.colorsBuffer = null;
    this.texCoordsBufferLayers = null;
    this.trianglesBuffer = null;
  }

  update(/** @type {Mesh} */ m) {
    this.verticesBuffer = GPU.createBuffer(
      m.vertices.length * 4 * 4,
      ["v", "s"],
      GPU.createBitData(m.vertices.flat(), ["f32"]),
    );
    this.normalsBuffer = GPU.createBuffer(
      m.normals.length * 4 * 4,
      ["v", "s"],
      GPU.createBitData(m.normals.flat(), ["f32"]),
    );
    this.tangentsBuffer = GPU.createBuffer(
      m.tangents.length * 4 * 4,
      ["v", "s"],
      GPU.createBitData(m.tangents.flat(), ["f32"]),
    );
    this.colorsBuffer = GPU.createBuffer(
      m.colors.length * 4 * 4,
      ["v", "s"],
      GPU.createBitData(m.tangents.flat(), ["f32"]),
    );
    this.texCoordsBufferLayers = m.texCoordsLayers.map((texCoordsLayer) =>
      GPU.createBuffer(
        texCoordsLayer.length * 2 * 4,
        ["v", "s"],
        GPU.createBitData(texCoordsLayer.flat(), ["f32"]),
      ),
    );
    this.trianglesBuffer = GPU.createBuffer(
      m.triangles.length * 3 * 4,
      ["i", "s"],
      GPU.createBitData(m.triangles.flat(), ["u32"]),
    );
  }
}

class SubMesh {
  constructor() {
    this.offset = 0;
    this.count = 0;
    /** @type {Material} */
    this.material = null;
  }

  setOffset(offset) {
    this.offset = offset;
  }

  setCount(count) {
    this.count = count;
  }

  setMaterial(material) {
    this.material = material;
  }
}

export class MeshRenderer {
  static createSubMesh() {
    return new SubMesh();
  }
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;

    /** @type {SubMesh[]} */
    this.subMeshes = [];

    this.gpu = new GPUDataManager();
  }

  addSubMeshe(subMesh) {
    this.subMeshes.push(subMesh);
  }

  updateMesh() {
    /** @type {Mesh} */
    const m = this.gameObject.getComponent(Mesh);
    this.gpu.update(m);
  }
}
