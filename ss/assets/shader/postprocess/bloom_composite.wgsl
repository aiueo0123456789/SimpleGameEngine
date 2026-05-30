ShaderSetting {
  depthCompare: always,
  depthWrite: off,
  topologyType: strip,
}

@bind(mySampler: sampler);
@bind(originalTexture: texture_2d<f32>); // 元画像
@bind(bloomTexture:    texture_2d<f32>); // Pass2bの出力

// bloomの強さ。大きいほど派手になる（0.5〜2.0 が目安）
const BLOOM_INTENSITY: f32 = 1.0;

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
  let original = textureSample(originalTexture, mySampler, texCoord).rgb;
  let bloom    = textureSample(bloomTexture,    mySampler, texCoord).rgb;

  // 加算合成。HDRトーンマップが後段にある場合はそのまま加算でOK
  let combined = original + bloom * BLOOM_INTENSITY;

  // 後段にトーンマップがない場合の簡易Reinhardトーンマップ
  // let tonemapped = combined / (combined + vec3<f32>(1.0));
  let tonemapped = combined;

  output.color = vec4<f32>(tonemapped, 1.0);
  return output;
}