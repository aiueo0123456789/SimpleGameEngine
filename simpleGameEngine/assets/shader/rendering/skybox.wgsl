ShaderSetting {
  depthCompare: always,
  depthWrite: false,
  topologyType: list,
}

import EngineCamera;
import inverse4x4;

@bind(<uniform> camera: EngineCamera);
@bind(mySampler: sampler);
@bind(skyboxTexture: texture_cube<f32>);

struct VInput {
  @builtin(vertex_index) vertex_index: u32
}

struct VOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) pos: vec4<f32>,
}

const vertices = array<vec2<f32>, 3>(
  vec2<f32>( 3.0,-1.0),
  vec2<f32>(-1.0, 3.0),
  vec2<f32>(-1.0,-1.0),
);

@vertex
fn vmain(input : VInput) -> VOutput {
  // スカイボックスの頂点をビュー行列で回転
  var output: VOutput;
  output.position = vec4f(vertices[input.vertex_index], 1, 1);
  output.pos = output.position;
  return output;
}

struct FInput {
  @location(0) pos: vec4<f32>,
}

struct FOutput {
  @location(0) color: vec4<f32>,
}

@fragment
fn fmain(input : FInput) -> FOutput {
  var output : FOutput;
  var vrM = camera.vM;
  vrM[3]  = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  let ivrpM = inverse4x4(camera.pM * vrM);
  let t = ivrpM * input.pos;
  output.color = textureSample(skyboxTexture, mySampler, normalize(t.xyz / t.w) * vec3f(1, 1, 1));
  return output;
}