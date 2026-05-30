import { vec3 } from "../../webgpuMatrix.js";
import { GameObject } from "../objects/GameObject.js";

export class MeshCollider {
  constructor(data) {
    /** @type {GameObject} */
    this.gameObject = data.gameObject;
    this.triangles = [];
    this.vertices = [];

    this.boundingbox = { min: vec3.create(), max: vec3.create() };

    this.chunkSize = 100;
    this.chunkW = 0;
    this.chunkH = 0;
    this.chunk = [];
  }

  generateChunk() {
    this.chunk.length = 0;
    const size = vec3.sub(this.boundingbox.max, this.boundingbox.min);
    this.chunkW = Math.ceil(size[0] / this.chunkSize) + 1;
    this.chunkH = Math.ceil(size[2] / this.chunkSize) + 1;
    for (let ci = 0; ci < this.chunkW * this.chunkH; ci++) {
      this.chunk.push([]);
    }
  }

  pointToChunkId(point) {
    const chunkX = Math.floor(
      (point[0] - this.boundingbox.min[0]) / this.chunkSize,
    );
    const chunkY = Math.floor(
      (point[2] - this.boundingbox.min[2]) / this.chunkSize,
    );
    return chunkX + chunkY * this.chunkW;
  }

  getChunkMesh(chunkId) {
    return this.chunk[chunkId];
  }

  computeChunk() {
    for (const triangle of this.triangles) {
      const v0 = this.vertices[triangle[0]];
      const v1 = this.vertices[triangle[1]];
      const v2 = this.vertices[triangle[2]];
      const v0ci = this.pointToChunkId(v0);
      const v1ci = this.pointToChunkId(v1);
      const v2ci = this.pointToChunkId(v2);
      const ciList = [];
      for (const ci of [v0ci, v1ci, v2ci]) {
        if (!ciList.includes(ci)) ciList.push(ci);
      }
      for (const ci of ciList) {
        this.chunk[ci].push([v0, v1, v2]);
      }
    }
  }

  computeBoundingbox() {
    vec3.copy([-Infinity, -Infinity, -Infinity], this.boundingbox.max);
    vec3.copy([Infinity, Infinity, Infinity], this.boundingbox.min);
    for (const vertex of this.vertices) {
      vec3.min(vertex, this.boundingbox.min, this.boundingbox.min);
      vec3.max(vertex, this.boundingbox.max, this.boundingbox.max);
    }
  }

  setMesh(mesh) {
    this.triangles.length = 0;
    this.vertices.length = 0;
    for (let vi = 0; vi < mesh.vertices.length; vi++) {
      this.vertices.push(mesh.vertices[vi]);
    }
    for (let ti = 0; ti < mesh.triangles.length; ti++) {
      this.triangles.push(mesh.triangles[ti]);
    }
    this.computeBoundingbox();
    this.generateChunk();
    this.computeChunk();
  }
}
