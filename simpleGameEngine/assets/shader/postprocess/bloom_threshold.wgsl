ShaderSetting {
  depthCompare: always,
  depthWrite: off,
  topologyType: strip,
}

@bind(mySampler: sampler);
@bind(inputTexture: texture_2d<f32>);

// 輝度しきい値。この値より明るいピクセルだけを通す
const THRESHOLD: f32 = 0.9;
const KNEE: f32 = 0.1; // ソフトニー（境界をなめらかに）

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

// 知覚輝度（Rec.709 係数）
fn luminance(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

@fragment
fn fmain(@location(0) texCoord: vec2<f32>) -> FOutput {
  var output: FOutput;
  let color = textureSample(inputTexture, mySampler, texCoord).rgb;
  let lum = luminance(color);

  // ソフトニーでしきい値以下をなめらかに落とす
  let knee_lo = THRESHOLD - KNEE;
  let knee_hi = THRESHOLD + KNEE;
  var weight: f32;
  if lum < knee_lo {
    weight = 0.0;
  } else if lum > knee_hi {
    weight = 1.0;
  } else {
    let t = (lum - knee_lo) / (2.0 * KNEE);
    weight = t * t;
  }

  output.color = vec4<f32>(color * weight, 1.0);
  return output;
}