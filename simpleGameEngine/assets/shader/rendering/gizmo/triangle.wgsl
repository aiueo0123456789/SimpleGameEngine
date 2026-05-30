ShaderSetting {
  depthCompare: always,
  depthWrite: false,
  topologyType: list,
  culling: none,
}

import EngineCamera;

const PI:      f32 = 3.14159265358979323846;
const INV_PI:  f32 = 0.31830988618379067154;
const HALF_PI: f32 = 1.57079632679489661923;
const EPS:     f32 = 1e-6;

@bind(<uniform> camera: EngineCamera);
@bind(<uniform> gizmo_flap_color: vec4<f32>);

struct VInput {
  @location(0) position: vec4<f32>,
}

struct VOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vmain(input : VInput) -> VOutput {
  var output : VOutput;
  output.position = camera.vpM * input.position;
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