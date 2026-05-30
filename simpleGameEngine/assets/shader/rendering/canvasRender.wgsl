ShaderSetting {
  depthCompare: always,
  depthWrite: false,
  topologyType: strip,
}

@bind(mySampler: sampler);
@bind(inputTexture: texture_2d<f32>);

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
};

const vertices = array<vec4<f32>, 4>(
  vec4<f32>(1.0, -1.0, 1.0, 1.0), // 左下
  vec4<f32>(1.0, 1.0, 1.0, 0.0),  // 左上
  vec4<f32>(-1.0, -1.0, 0.0, 1.0),// 右下
  vec4<f32>(-1.0, 1.0, 0.0, 0.0), // 右上
);

@vertex
fn vmain(
  @builtin(vertex_index) vertexIndex: u32
) -> VSOutput {
  var output: VSOutput;
  let point = vertices[vertexIndex];
  output.position = vec4<f32>(point.xy, 0.0, 1.0);
  output.texCoord = point.zw;
  return output;
}

struct FOutput {
  @location(0) color: vec4<f32>,
}

@fragment
fn fmain(@location(0) texCoord: vec2<f32>) -> FOutput {
  var output : FOutput;
  output.color = textureSample(inputTexture, mySampler, texCoord);
  return output;
}