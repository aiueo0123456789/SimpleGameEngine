ShaderSetting {
  depthCompare: always,
  depthWrite: off,
  topologyType: strip,
}

@bind(mySampler: sampler);
@bind(inputTexture: texture_2d<f32>);

// ガウスカーネル（σ≈2, 9タップ）
const WEIGHTS = array<f32, 5>(
  0.2270270270,
  0.1945945946,
  0.1216216216,
  0.0540540541,
  0.0162162162,
);

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
};

const vertices = array<vec4<f32>, 4>(
  vec4<f32>( 1.0, -1.0, 1.0, 1.0),
  vec4<f32>( 1.0,  1.0, 1.0, 0.0),
  vec4<f32>(-1.0, -1.0, 0.0, 1.0),
  vec4<f32>(-1.0,  1.0, 0.0, 0.0),
);

@vertex
fn vmain(@builtin(vertex_index) vertexIndex: u32) -> VSOutput {
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
  var output: FOutput;
  let texSize = vec2<f32>(textureDimensions(inputTexture));
  let texelSize = vec2<f32>(1.0 / texSize.x, 0.0); // 水平方向のみ

  var result = textureSample(inputTexture, mySampler, texCoord).rgb * WEIGHTS[0];
  for (var i: i32 = 1; i < 5; i++) {
    let offset = texelSize * f32(i);
    result += textureSample(inputTexture, mySampler, texCoord + offset).rgb * WEIGHTS[i];
    result += textureSample(inputTexture, mySampler, texCoord - offset).rgb * WEIGHTS[i];
  }

  output.color = vec4<f32>(result, 1.0);
  return output;
}