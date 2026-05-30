import { vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";
import { GPU } from "../utils/webGPU.js";
import { MeshRenderer } from "./MeshRenderer.js";

class GPUDataManager {
  constructor() {
    this.verticesBuffer = null;
    this.normalsBuffer = null;
    this.tangentsBuffer = null;
    this.colorsBuffer = null;
    this.texCoordsBufferLayers = null;
    this.trianglesBuffer = null;
    this.skinIndexsBuffer = null;
    this.skinWeightsBuffer = null;
    this.bindPosesBuffer = null;
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
    this.skinIndexsBuffer = GPU.createBuffer(
      m.skinWeights.length * 4 * 4,
      ["s"],
      GPU.createBitData(m.skinIndexs.flat(), ["u32"]),
    );
    this.skinWeightsBuffer = GPU.createBuffer(
      m.skinWeights.length * 4 * 4,
      ["s"],
      GPU.createBitData(m.skinWeights.flat(), ["f32"]),
    );
    this.bindPosesBuffer = GPU.createBuffer(
      m.bindPoses.length * 4 * 4 * 4,
      ["s"],
      GPU.createBitData(m.bindPoses.flat(), ["f32"]),
    );
  }
}

export class Mesh {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    /** @type {[Number, Number, Number, Number][]} */
    this.vertices = [];
    /** @type {[Number, Number][][]} */
    this.texCoordsLayers = [];
    /** @type {[Number, Number, Number, Number][]} */
    this.normals = [];
    /** @type {[Number, Number, Number, Number][]} */
    this.tangents = [];
    /** @type {[Number, Number, Number, Number][]} */
    this.colors = [];
    /** @type {[Number, Number, Number][]} */
    this.triangles = [];
    this.skinIndexs = [];
    this.skinWeights = [];
    this.bindPoses = [];
    this.gpu = new GPUDataManager();
  }

  get verticesNum() {
    return this.vertices.length;
  }

  get trianglesNum() {
    return this.triangles.length;
  }

  computeTangents() {
    this.tangents.length = 0;
    const vertexCount = this.vertices.length;
    const tangentAccum = Array.from({ length: vertexCount }, () =>
      vec3.create(0, 0, 0),
    );

    for (const [i0, i1, i2] of this.triangles) {
      const p0 = this.vertices[i0],
        p1 = this.vertices[i1],
        p2 = this.vertices[i2];
      const uv0 = this.texCoordsLayers[0][i0],
        uv1 = this.texCoordsLayers[0][i1],
        uv2 = this.texCoordsLayers[0][i2];

      const E1 = vec3.create(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      const E2 = vec3.create(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);

      const dU1 = uv1[0] - uv0[0],
        dV1 = uv1[1] - uv0[1];
      const dU2 = uv2[0] - uv0[0],
        dV2 = uv2[1] - uv0[1];

      const det = dU1 * dV2 - dU2 * dV1;
      if (Math.abs(det) < 1e-8) continue;
      const r = 1.0 / det;

      const T = vec3.create(
        (dV2 * E1[0] - dV1 * E2[0]) * r,
        (dV2 * E1[1] - dV1 * E2[1]) * r,
        (dV2 * E1[2] - dV1 * E2[2]) * r,
      );

      for (const idx of [i0, i1, i2]) {
        vec3.add(tangentAccum[idx], T, tangentAccum[idx]);
      }
    }

    for (let i = 0; i < vertexCount; i++) {
      const N = vec3.create(
        this.normals[i][0],
        this.normals[i][1],
        this.normals[i][2],
      );
      const T = tangentAccum[i];

      // Gram-Schmidt: T - dot(T,N)*N
      const dot = vec3.dot(T, N);
      const Torth = vec3.subtract(T, vec3.scale(N, dot), vec3.create());

      const len = vec3.length(Torth);
      if (len < 1e-8) {
        this.tangents.push([1, 0, 0, 1]);
        continue;
      }

      const Tnorm = vec3.scale(Torth, 1 / len, vec3.create());
      this.tangents.push([Tnorm[0], Tnorm[1], Tnorm[2], 1.0]);
    }
  }

  setMesh(mesh) {
    this.triangles.length = 0;
    this.vertices.length = 0;
    this.texCoordsLayers.length = 0;
    this.normals.length = 0;
    this.skinIndexs.length = 0;
    this.skinWeights.length = 0;
    for (let vi = 0; vi < mesh.vertices.length; vi++) {
      this.vertices.push(mesh.vertices[vi]);
      // texCoordは複数レイヤーに対応
      for (
        let layerIndex = 0;
        layerIndex < mesh.texCoords[vi].length;
        layerIndex++
      ) {
        const needLayerNum = layerIndex + 1;
        if (this.texCoordsLayers.length < needLayerNum) {
          for (
            let _i = 0;
            _i < needLayerNum - this.texCoordsLayers.length;
            _i++
          ) {
            this.texCoordsLayers.push([]);
          }
        }
        this.texCoordsLayers[layerIndex].push(mesh.texCoords[vi][layerIndex]);
      }
      this.colors.push(mesh.colors[vi]);
      this.normals.push(mesh.normals[vi]);
      if (mesh.skinIndexs) this.skinIndexs.push(mesh.skinIndexs[vi]);
      else this.skinIndexs.push([0, 0, 0, 0]);
      if (mesh.skinWeights) this.skinWeights.push(mesh.skinWeights[vi]);
      else this.skinWeights.push([0, 0, 0, 0]);
    }
    for (let ti = 0; ti < mesh.triangles.length; ti++) {
      this.triangles.push(mesh.triangles[ti]);
    }
    if (mesh.bindPoses) {
      for (let bi = 0; bi < mesh.bindPoses.length; bi++) {
        this.bindPoses.push(mesh.bindPoses[bi]);
      }
    }
    console.log(this);
    this.computeTangents();
    this.gpu.update(this);
    if (this.gameObject.hasComponent(MeshRenderer)) {
      this.gameObject.getComponent(MeshRenderer).updateMesh();
    }
  }
}
