ShaderSetting {
  depthCompare: less,
  depthWrite: true,
  topologyType: list,
}

import EngineCamera;
import EngineLight;
import PrincipledMaterial;
import ShadingContext;
import principled_bsdf_eval;
import normalmap;
import computeTBN;
import make_shading_ctx;
import linearToSRGB;

const PI:      f32 = 3.14159265358979323846;
const INV_PI:  f32 = 0.31830988618379067154;
const HALF_PI: f32 = 1.57079632679489661923;
const EPS:     f32 = 1e-6;

@bind(<uniform> camera: EngineCamera);
@bind(<uniform> light: EngineLight);
@bind(mySampler: sampler);
@bind(colorTexture: texture_2d<f32>);
@bind(metallicTexture: texture_2d<f32>);
@bind(normalTexture: texture_2d<f32>);
@bind(roughnessTexture: texture_2d<f32>);

struct VInput {
  @location(0) position: vec4<f32>,
  @location(1) normal: vec4<f32>,
  @location(2) tangent: vec4<f32>,
  @location(3) texCoord: vec2<f32>,
}

struct VOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) lightPosition: vec3<f32>,
  @location(2) normal: vec3<f32>,
  @location(3) tangent: vec3<f32>,
  @location(4) texCoord: vec2<f32>,
};

@vertex
fn vmain(input : VInput) -> VOutput {
  var output : VOutput;
  output.worldPosition = input.position.xyz;
  output.position = camera.vpM * input.position;

  let positionFromLight = light.vpM * input.position;
  output.lightPosition = vec3<f32>(positionFromLight.xy * vec2(0.5, -0.5) + vec2(0.5), positionFromLight.z);

  output.normal = normalize(input.normal.xyz);
  output.tangent = normalize(input.tangent.xyz);
  output.texCoord = input.texCoord;
  return output;
}

struct FInput {
  @location(0) worldPosition: vec3<f32>,
  @location(1) lightPosition: vec3<f32>,
  @location(2) normal: vec3<f32>,
  @location(3) tangent: vec3<f32>,
  @location(4) texCoord: vec2<f32>,
}

struct FOutput {
  @location(0) color: vec4<f32>,
  @location(1) normalColor: vec4<f32>
}

@fragment
fn fmain(input : FInput) -> FOutput {
  var output : FOutput;
  var principledMaterial : PrincipledMaterial;
  principledMaterial.base_color = textureSample(colorTexture, mySampler, input.texCoord).rgb;
  principledMaterial.metallic = textureSample(metallicTexture, mySampler, input.texCoord).r;
  principledMaterial.roughness = textureSample(roughnessTexture, mySampler, input.texCoord).r;
  principledMaterial.anisotropic = 0.0;
  principledMaterial.anisotropic_rotation = 0.0;

  principledMaterial.ior = 1.4;
  principledMaterial.specular_tint = 0.5;

  principledMaterial.subsurface = 0.0;
  principledMaterial.subsurface_color = vec3f(1.0);

  principledMaterial.transmission = 0.0;

  principledMaterial.sheen = 0.0;
  principledMaterial.sheen_roughness = 0.5;
  principledMaterial.sheen_tint = 1.0;

  principledMaterial.clearcoat = 0.0;
  principledMaterial.clearcoat_roughness = 0.5;
  principledMaterial.clearcoat_ior = 1.5;

  principledMaterial.emission_strength = 0.0;
  principledMaterial.emission = vec3f(0.0);

  principledMaterial.alpha = 1.0;

  let normalizedN = normalize(input.normal);
  let normalizedT = normalize(input.tangent);
  let shadingContext = make_shading_ctx(normalizedN, normalizedT, 1.0, normalize(camera.transform.position - input.worldPosition), -light.transform.dir, textureSample(normalTexture, mySampler, input.texCoord).rgb, 1.0);

  let radiance = light.color * light.intensity;
  output.color = vec4f(linearToSRGB(principled_bsdf_eval(principledMaterial, shadingContext) * radiance), 1.0);
  // output.color = vec4f(principledMaterial.base_color, 1.0);
  // output.color = vec4f(vec3f(principledMaterial.metallic), 1.0);
  output.normalColor = vec4<f32>(normalizedN / 2.0 + 0.5, 1.0);
  return output;
}