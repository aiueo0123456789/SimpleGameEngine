import hsvAdjust;
import brightnessContrast;
import colorLamp;
import getLayerWeight;
import rangeMapping;
import cmp;
import specular;
import normalmap;
import extract3x3;
import inverse3x3;

fn character_color(faceNormal: vec3<f32>, color: vec3<f32>, lightDir: vec3<f32>, lightColor: vec3<f32>, cameraDir: vec3<f32>) -> vec3<f32> {
  let lightSmooth = 0.1;
  let lDot = dot(faceNormal, -lightDir);
  let lSmooth = smoothstep(0.0, lightSmooth, lDot);
  return mix(0.8, 1, lSmooth) * (color * lightColor);
}

fn smoothstep001(value1: f32, value2: f32, value3: f32, value4: f32) -> f32 {
  let k0 = value2 + value3;
  let k1 = value2 + value4;
  let k3 = value1 - k0;
  let k4 = k1 - k0;
  let k5 = saturate(k3 / k4);
  let k6 = k5 * k5;
  let k7 = (3.0 - k5 * 2.0);
  return k6 * k7;
}

// normalizedNdotL = NdoL * -0.5 + 0.5
fn faceSDF(faceLightTextureColor: vec3<f32>, normalizedNdotL: f32, stepA: f32, stepB: f32) -> f32 {
  let k0 = smoothstep001(faceLightTextureColor.r, normalizedNdotL, stepA, stepB);
  let k1 = smoothstep001(faceLightTextureColor.g, normalizedNdotL, stepA, stepB) * 0.92;
  return k0 * k1;
}

fn zzzFaceShader(isFace: f32, color: vec3<f32>, saturation: f32, brightness: f32, faceLightTextureColor: vec3<f32>, NdotL: f32, normalizedNdotL: f32, faceForward: vec3<f32>, faceRight: vec3<f32>, stepA: f32, stepB: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>, hairColor: vec3<f32>) -> vec3<f32> {
  let k0 = hsvAdjust(0.5, saturation, brightness, 1.0, color);
  let k1= faceSDF(faceLightTextureColor, normalizedNdotL, stepA, stepB);
  let k1_0= colorLamp(array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(0.0)), array<f32, 4>(0.191, 0.443, 0.0, 0.0), 2u, k1).r;
  let k1_1= colorLamp(array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(0.0)), array<f32, 4>(0.016, 0.262, 0.0, 0.0), 2u, k1).r;
  let k1_2= colorLamp(array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(0.0)), array<f32, 4>(0.085, 0.27, 0.0, 0.0), 2u, k1).r;
  let k1_0_0 = mix(d, b, saturate(k1_0));
  let k1_1_0 = mix(d, c, saturate(k1_1));
  let k1_2_0 = mix(d, a, saturate(k1_2));
  let k2 = k1_0_0 + k1_1_0 + k1_2_0;
  let k3 = k2 * (1.0 / 3.0);
  let k4 = hsvAdjust(0.5, 1.0 ,2.0, 1.0, k3);
  let k5 = k4 * k0;
  // この後に顔だけの特別な処理があるけど今は作らない
  return k5;
}

fn customTonemapping(color: vec3<f32>, a: f32, b: f32, c: f32, d: f32, e: f32) -> vec3<f32> {
  let k0 = a * color;
  let k1 = c * color;
  let k2 = b + k0;
  let k3 = d + k1;
  let k4 = k2 * color;
  let k5 = k3 * color;
  let k6 = k5 + e;
  return k4 / k6;
}

// この関数関数の必要条件
// rampMixingTextureというtexture
// effMatcapというtexture
// EngineCameraをcameraで宣言
// mySamplerというテクスチャサンプラー
fn zzzMainShader(
  TBN: mat3x3<f32>, WP: vec3<f32>, N: vec3<f32>,
  color: vec3<f32>, colorCalibration: vec3<f32>, saturation: f32, brightness: f32, AOcolor: vec3<f32>,
  nonmetalSaturation: f32, nonmetallicLuster: f32, metallicColor: vec3<f32>,
  originalNormalmapXY: vec3<f32>, normalmapXYZ: vec3<f32>, useOriginal: f32, normalmapStrength: f32, mixingStrength: f32,
  nonmetallicContrastAdjustment: f32, basicHighGlossStrength: f32, metallicColorCalibration: vec3<f32>, metallicLuster: f32,
  underskinColor: vec3<f32>, underskinColorStrength: f32,
  tonemappingA: f32, tonemappingB: f32, tonemappingC: f32, tonemappingD: f32, tonemappingE: f32,
  castShadowStrength: f32, castShadowMask: f32,
  ramp_V: f32,
  ramp1A: vec3<f32>, ramp1B: vec3<f32>, ramp1C: vec3<f32>, ramp1D: vec3<f32>,
  ramp2A: vec3<f32>, ramp2B: vec3<f32>, ramp2C: vec3<f32>, ramp2D: vec3<f32>,
  ramp3A: vec3<f32>, ramp3B: vec3<f32>, ramp3C: vec3<f32>, ramp3D: vec3<f32>,
  ramp4A: vec3<f32>, ramp4B: vec3<f32>, ramp4C: vec3<f32>, ramp4D: vec3<f32>,
  ramp5A: vec3<f32>, ramp5B: vec3<f32>, ramp5C: vec3<f32>, ramp5D: vec3<f32>,
  AO_G_INT: f32,
  stylizationOfHighlights: f32,
  highlightColor: vec3<f32>,
  edgeLightColor: vec3<f32>,
) -> vec3<f32> {
  let VDir = normalize(camera.transform.position - WP);
  let LDir = -light.transform.dir;
  let colorHSV = hsvAdjust(0.5, saturation, brightness, 1.0, color);
  var k0 = originalNormalmapXY.xy;
  var normalSqrtLength = dot(k0, k0);
  let normalNormalizedSqrtLength= saturate(normalSqrtLength);
  let k1 = 1.0 - normalNormalizedSqrtLength;
  let normalLength = sqrt(k1);
  let originalNormal = vec3<f32>(k0.xy, normalLength);
  let normalmapColor = mix(originalNormal, normalmapXYZ, useOriginal); // useOriginal(use: 0)
  let normalmapNormal = normalmap(TBN, normalmapColor, normalmapStrength);
  let normal_ = normalize(mix(normalmapNormal, N, mixingStrength));

  let NdotL = dot(normal_, LDir);
  // let NdotL = dot(N, LDir);
  let k2 = rangeMapping(NdotL * -0.5 + 0.5, 0.0, 1.0, 0.03, 0.997);
  let rampMixingTextureuv = vec2<f32>(k2, clamp(ramp_V, 0.005, 0.995));
  let rampMixingTextureColor = textureSample(rampMixingTexture, mySampler, rampMixingTextureuv).rgb;
  let k4 = rampMixingTextureColor;

  let ramp1_k0 = mix(ramp1A, ramp1D, k4.b);
  let ramp1_k1 = mix(ramp1A, ramp1C, k4.g);
  let ramp1_k2 = mix(ramp1A, ramp1B, k4.r);
  let ramp1_k3 = (ramp1_k0 + ramp1_k1 + ramp1_k2) * (1.0 / 3.0);

  let ramp2_k0 = mix(ramp2A, ramp2D, k4.b);
  let ramp2_k1 = mix(ramp2A, ramp2C, k4.g);
  let ramp2_k2 = mix(ramp2A, ramp2B, k4.r);
  let ramp2_k3 = (ramp2_k0 + ramp2_k1 + ramp2_k2) * (1.0 / 3.0);

  let ramp3_k0 = mix(ramp3A, ramp3D, k4.b);
  let ramp3_k1 = mix(ramp3A, ramp3C, k4.g);
  let ramp3_k2 = mix(ramp3A, ramp3B, k4.r);
  let ramp3_k3 = (ramp3_k0 + ramp3_k1 + ramp3_k2) * (1.0 / 3.0);

  let ramp4_k0 = mix(ramp4A, ramp4D, k4.b);
  let ramp4_k1 = mix(ramp4A, ramp4C, k4.g);
  let ramp4_k2 = mix(ramp4A, ramp4B, k4.r);
  let ramp4_k3 = (ramp4_k0 + ramp4_k1 + ramp4_k2) * (1.0 / 3.0);

  let ramp5_k0 = mix(ramp5A, ramp5D, k4.b);
  let ramp5_k1 = mix(ramp5A, ramp5C, k4.g);
  let ramp5_k2 = mix(ramp5A, ramp5B, k4.r);
  let ramp5_k3 = (ramp5_k0 + ramp5_k1 + ramp5_k2) * (1.0 / 3.0);

  let rampTypeColor = metallicColor.r;
  let ramp1 = cmp(rampTypeColor, 0.0, 0.11) * ramp1_k3;
  let ramp2 = cmp(rampTypeColor, 0.3, 0.11) * ramp2_k3;
  let ramp3 = cmp(rampTypeColor, 0.5, 0.11) * ramp3_k3;
  let ramp4 = cmp(rampTypeColor, 0.7, 0.11) * ramp4_k3;
  let ramp5 = cmp(rampTypeColor, 1.0, 0.11) * ramp5_k3;
  let ramp = ramp1 + ramp2 + ramp3 + ramp4 + ramp5;
  let color0 = ramp * colorHSV;
  // let color0 = vec3<f32>(1.0) * colorHSV;

  let AOcolorG_cpm = select(0.0, 1.0, 0.1 < AOcolor.b && AOcolor.b < 0.7);
  // let AOcolorG_cpm = cmp(AOcolor.g, 0.2, 0.05);
  // let AOcolorG_cpm = select(0.0, 1.0, AOcolor.g > 0.01); // 条件を独自に反転
  let AOcolorG_lamp = select(0.0, 1.0, 0.081818 < AOcolor.b);

  // タイツみたいな効果
  let layerWeight0= getLayerWeight(N, VDir, 0.4);
  let layerWeight0_lamp= colorLamp(array<vec3<f32>, 4>(vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0)), array<f32, 4>(0.0, 0.813636, 0.0, 0.0), 2u, layerWeight0).r;
  let layerWeight0_lamp_lamp= colorLamp(array<vec3<f32>, 4>(vec3<f32>(0.172401), vec3<f32>(0.257366), vec3<f32>(0.5), vec3<f32>(1.0)), array<f32, 4>(0.655615, 0.841778, 0.962032, 1.0), 4u, layerWeight0_lamp).r;

  let layerWeight1= getLayerWeight(N, VDir, 0.5);
  let layerWeight1_lamp= colorLamp(array<vec3<f32>, 4>(vec3<f32>(1.0), vec3<f32>(0.212881, 0.145476, 0.159136), vec3<f32>(0.006258), vec3<f32>(0.000464, 0.000431, 0.000439)), array<f32, 4>(0.245455, 0.476136, 0.597727, 0.639205), 4u, layerWeight1);

  let color1 = mix(vec3<f32>(2.0), mix(vec3<f32>(0.579171, 0.423809, 0.375659), vec3<f32>(1.0), AOcolor.g), AOcolorG_cpm);

  let color2 = mix(color0, color0 * color1, 0.841808);
  let color3 = mix(color2, color2 * layerWeight1_lamp, 0.525424);

  let color4 = mix(color3, color3 * layerWeight0_lamp_lamp, 0.225989); // バグあり
  let color5 = mix(color0, color4, AOcolorG_cpm);

  // sss
  let sssN = normalize(mix(N, WP, 0.783333));
  let sss_k0 = smoothstep001(rangeMapping(dot(sssN, LDir), 0.0, 0.2, 0.01, 3.6), 0.0, 0.0, 0.2);
  let sss_k1 = colorLamp(array<vec3<f32>, 4>(vec3<f32>(1.0), vec3<f32>(0.5), vec3<f32>(0.019885), vec3<f32>(0.0)), array<f32, 4>(0.05, 0.568182, 0.929546, 0.0), 3u, sss_k0);
  let sss_k2 = colorLamp(array<vec3<f32>, 4>(vec3<f32>(0.011686), vec3<f32>(0.5), vec3<f32>(1.0), vec3<f32>(0.0)), array<f32, 4>(0.277273, 0.518182, 0.986364, 0.0), 3u, k2);
  let sss_k3 = sss_k1 * sss_k2 * sss_k0;
  let sss_k4 = sss_k3 * underskinColorStrength;
  let sssColor = mix(vec3<f32>(sss_k4), sss_k4 * underskinColor, 0.925);

  let color6 = mix(color5, color5 + sssColor, cmp(metallicColor.r, 1.0, 0.01)); // 肌の場合だけmix

  let color7 = AOcolor.b * AOcolorG_lamp;

  let color8 = mix(color6, color6 * color7, AO_G_INT);
  let color9 = hsvAdjust(0.5, nonmetalSaturation, nonmetallicLuster, 1.0, color8);
  let color10 = brightnessContrast(color9, 0.0, nonmetallicContrastAdjustment) * colorCalibration;

  // Blinn-Phong
  let blinnPhong_k0 =  saturate(dot(normal_, normalize(LDir + N)));
  let blinnPhong_k1 =  pow(blinnPhong_k0, 16.0);
  let blinnPhong_k2 =  pow(blinnPhong_k0, 4.8);

  // basicHighlights
  let basicHighlights_k0 = colorLamp(array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(0.020369, 0.014141, 0.015058), vec3<f32>(0.040746, 0.030187, 0.032273), vec3<f32>(0.0)), array<f32, 4>(0.195455, 0.377273, 1.0, 0.0), 3u, blinnPhong_k2);;
  let basicHighlights_k1 = blinnPhong_k1 * metallicColor.b * basicHighGlossStrength;
  let color11 = mix(vec3<f32>(basicHighlights_k1), basicHighlights_k0, AOcolorG_cpm);

  let color12 = color10 + color11;

  // 金属
  let cameraAxisNormal = transpose(inverse3x3(extract3x3(camera.vM))) * N;
  let normalizedCameraAxisNormal = cameraAxisNormal * 0.5 + 0.5;
  let eff_Matcap_011Color = textureSample(effMatcap, mySampler, normalizedCameraAxisNormal.xy).r;
  let metallic_k0 = metallicColor.g * eff_Matcap_011Color * 2.0 * blinnPhong_k1;
  let metallic_k1 = metallicColor.g * 16.5 * blinnPhong_k1;
  let metallic_k2 = metallic_k0 + metallic_k1;

  // let glossyBSDF0 = specular(N, VDir, vec3<f32>(1.0), 0.738462).r; // ここはカラーランプをつける
  // let glossyBSDF1 = specular(N, VDir, vec3<f32>(1.0), 0.092308).r;
  let glossyBSDF0 = specular(N, VDir, vec3<f32>(1.0), 0.738462).r; // ここはカラーランプをつける
  let glossyBSDF1 = specular(N, VDir, vec3<f32>(1.0), 0.092308).r;
  let glossy = mix(glossyBSDF1, glossyBSDF0, stylizationOfHighlights) * 3.0;
  let metallic_k3 = metallic_k2 * glossy * metallicLuster;
  let metallicColor_ = metallic_k3 * metallicColorCalibration * highlightColor;

  let color13 = color12 + metallicColor_;

  let color14 = customTonemapping(color13, tonemappingA, tonemappingB, tonemappingC, tonemappingD, tonemappingE);

  let layerWeight1_lamp2 = colorLamp(array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(0.006258), vec3<f32>(1.0), vec3<f32>(0.0)), array<f32, 4>(0.455682, 0.648, 1.0, 0.0), 3u, layerWeight1).r;
  let k5 = NdotL * 0.5 + 0.5;
  let k6 = k5 * 0.1; // 1.0のとこほんとはなんか色々してる
  let k7 = k6 * layerWeight1_lamp2;
  let edgeColor = k7 * edgeLightColor;

  let color15 = color14 + edgeColor;

  // cmp(rampTypeColor, 0.0, 0.11)
  // cmp(rampTypeColor, 0.3, 0.11)
  // cmp(rampTypeColor, 0.5, 0.11)
  // cmp(rampTypeColor, 0.7, 0.11)
  // cmp(rampTypeColor, 1.0, 0.11)
  // return vec3<f32>(
  //   cmp(rampTypeColor, 0.0, 0.11),
  //   cmp(rampTypeColor, 0.3, 0.11),
  //   cmp(rampTypeColor, 0.5, 0.11),
  // );
  // return vec3<f32>(
  //   cmp(rampTypeColor, 0.7, 0.11),
  //   cmp(rampTypeColor, 1.0, 0.11),
  //   0.0
  // );
  // return vec3<f32>(metallicColor.r, 0.0, 0.0);
  // return vec3<f32>(metallicColor.g, 0.0, 0.0); // 間違いなく反射度だとおもっていい
  // return vec3<f32>(metallicColor.b, 0.0, 0.0);
  // return vec3<f32>(AOcolor.r, 0.0, 0.0); // 透明度の可能性あり
  // return vec3<f32>(AOcolor.g, 0.0, 0.0);
  // return vec3<f32>(AOcolor.b, 0.0, 0.0);
  // return vec3<f32>(glossyBSDF1);
  return color15;
}