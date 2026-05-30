export class Gizmo {
  static createShape(Shape) {
    return new Shape();
  }

  constructor() {
    this.shapes = [];
  }

  addShape(shape) {
    this.shapes.push(shape);
  }
}