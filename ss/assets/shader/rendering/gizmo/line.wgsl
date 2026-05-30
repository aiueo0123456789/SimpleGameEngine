ShaderSetting {
  depthCompare: always,
  depthWrite: false,
  topologyType: list,
}

import EngineCamera;

const PI:      f32 = 3.14159265358979323846;
const INV_PI:  f32 = 0.31830988618379067154;
const HALF_PI: f32 = 1.57079632679489661923;
const EPS:     f32 = 1e-6;

struct Flap {
  position: vec4<f32>,
  veloctity: vec4<f32>,
}

@bind(<uniform> camera: EngineCamera);
@bind(<uniform> gizmo_flap_data: array<Flap>);
@bind(<uniform> gizmo_flap_color: vec4<f32>);

struct VInput {
  @builtin(instance_index) instanceIndex: u32,
  @builtin(vertex_index) vertexIndex: u32,
}

struct VOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vmain(input : VInput) -> VOutput {
  var output : VOutput;
  let gizmoData = gizmo_flap_data[instanceIndex];
  let p0 = camera.vpM * gizmoData.position;
  let p1 = camera.vpM * (gizmoData.position + gizmoData.veloctity);
  var position = vec4<f32>(0.0);
  if (vertexIndex == 0u) {
      position = vec4f(p0.xy + normalize((p1 - p0).yx) * 0.1, p0.zw);
  } else if (vertexIndex == 1u) {
      position = p1.xyzw;
  } else if (vertexIndex == 2u) {
      position = vec4f(p0.xy - normalize((p1 - p0).yx) * 0.1, p0.zw);
  }
  output.position = position;
  return output;
}

struct FOutput {
  @location(0) color: vec4<f32>,
}

@fragment
fn fmain() -> FOutput {
  var output : FOutput;
  output.color = gizmo_flap_color;
  return output;
}