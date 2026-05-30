import { mat4, vec3 } from "../../webgpuMatrix.js";

class Point {
  constructor() {
    this.left = vec3.create();
    this.co = vec3.create();
    this.right = vec3.create();
  }

  setLeft(position) {
    vec3.copy(position, this.left);
  }
  setCo(position) {
    vec3.copy(position, this.co);
  }
  setRight(position) {
    vec3.copy(position, this.right);
  }
}

class Weight {
  constructor(curveIndex, t, length) {
    this.curveIndex = curveIndex;
    this.t = t;
    this.length = length;
  }
}

export class Bezier {
  static createPoint() {
    return new Point();
  }
  constructor(data) {
    this.gameObject = data.gameObject;
    /** @type {Point[]} */
    this.points = [];
    /** @type {Weight[]} */
    this.weightTable = [];
    this.length = 0;
    this.isLoop = false;
  }

  setIsLoop(isLoop) {
    this.isLoop = isLoop;
    this.updateWeightTable();
  }

  get curvesNum() {
    return this.isLoop ? this.points.length : this.points.length - 1;
  }

  getCurve(curveIndex) {
    let left = this.points[curveIndex];
    let right = this.isLoop
      ? this.points[(curveIndex + 1) % this.points.length]
      : this.points[curveIndex + 1];
    return [left.co, left.right, right.left, right.co];
  }

  getCurvatureRadius(z) {
    const near = this.getCurveIndexAndT(z);
    const vertices = this.getCurve(near.curveIndex);
    const t = near.t;

    const d1 = vec3.bezierTangent(...vertices, t); // 1階微分
    const d2 = vec3.bezierSecondDerivative(...vertices, t); // 2階微分

    const cross = vec3.cross(d1, d2);
    const crossLen = vec3.length(cross);
    const d1Len = vec3.length(d1);

    // κ = |d1×d2| / |d1|^3
    const kappa = crossLen / Math.pow(d1Len, 3);
    return kappa < 1e-6 ? Infinity : 1 / kappa; // 曲率半径
  }

  getCurveIndexAndT(z) {
    let minCurveIndex = 0;
    let minT = 0;
    let minDistance = Infinity;
    for (const table of this.weightTable) {
      const dist = Math.abs(table.length - z);
      if (dist < minDistance) {
        minDistance = dist;
        minCurveIndex = table.curveIndex;
        minT = table.t;
      }
    }
    return { curveIndex: minCurveIndex, t: minT };
  }

  getTransformationMatrixByZ(z) {
    const { curveIndex, t } = this.getCurveIndexAndT(z);
    const vertices = this.getCurve(curveIndex);
    const tangent = vec3.bezierTangent(...vertices, t);
    const position = vec3.bezier(...vertices, t);
    const rotMatrix = mat4.fromTangent(tangent);
    const posMatrix = mat4.translate(mat4.identity(), position);

    return mat4.multiply(posMatrix, rotMatrix);
  }

  getTransformationMatrix(point) {
    let minCurveIndex = 0;
    let minT = 0;
    let minDistance = Infinity;
    for (let curveIndex = 0; curveIndex < this.curvesNum; curveIndex++) {
      const vertices = this.getCurve(curveIndex);
      const result = vec3.nearestPointBezier(...vertices, point);
      if (result.distance < minDistance) {
        minDistance = result.distance;
        minCurveIndex = curveIndex;
        minT = result.t;
      }
    }
    console.log(minCurveIndex, minT);
    const vertices = this.getCurve(minCurveIndex);
    const tangent = vec3.bezierTangent(...vertices, minT);
    const position = vec3.bezier(...vertices, minT);
    const rotMatrix = mat4.fromTangent(tangent);
    const posMatrix = mat4.translate(mat4.identity(), position);
    console.log(position);
    return mat4.multiply(posMatrix, rotMatrix);
  }

  appendPoint(point) {
    if (point instanceof Point) {
      this.points.push(point);
      this.updateWeightTable();
    }
  }

  updateWeightTable() {
    const deltaT = 0.01;
    this.length = 0;
    let sumLength = 0;
    let leftPosition = this.points[0].co;
    for (let curveIndex = 0; curveIndex < this.curvesNum; curveIndex++) {
      const vertices = this.getCurve(curveIndex);
      for (let t = deltaT; t < 1.0; t += deltaT) {
        const rightPosition = vec3.bezier(...vertices, t);
        sumLength += vec3.distance(rightPosition, leftPosition);
        leftPosition = rightPosition;
      }
    }
    this.length = sumLength;
    console.log(this);
  }
}
