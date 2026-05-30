class GeometryMesh {
  constructor() {
    this.face = [];
    this.vertex = [];
    this.edge = [];
  }
}

class GeometryCurve {
  constructor() {
    this.controlPoint = [];
  }
}

class Geometry {
  constructor() {
    /** @type {GeometryMesh} */
    this.mesh = new GeometryMesh();
    /** @type {GeometryCurve} */
    this.curve = new GeometryCurve();
  }
}

export class GeometryNodes {
  constructor() {}

  static;
}
