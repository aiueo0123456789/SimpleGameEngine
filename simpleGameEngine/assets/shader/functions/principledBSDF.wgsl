// ================================================================
//  Principled BSDF — WGSL Implementation
//  Blender の Principled BSDF を WebGPU Shading Language で再現
//  Based on: Disney Principled BRDF (Burley 2012 / 2015)
//            Blender Cycles source (intern/cycles/kernel/closure/)
// ================================================================

// ================================================================
//  マテリアルパラメータ構造体
// ================================================================
import PrincipledMaterial;

// ================================================================
//  ライティングコンテキスト
// ================================================================
import ShadingContext;

const PI:      f32 = 3.14159265358979323846;
const INV_PI:  f32 = 0.31830988618379067154;
const HALF_PI: f32 = 1.57079632679489661923;
const EPS:     f32 = 1e-6;

fn make_shading_ctx(
    N:               vec3f,  // 幾何法線 (world space, normalized)
    T:               vec3f,  // タンジェント (world space, normalized)
    tangent_w:       f32,    // タンジェントの W 符号 (+1 or -1)。不明なら 1.0
    V:               vec3f,  // 視線方向 (surface → camera, normalized)
    L:               vec3f,  // ライト方向 (surface → light, normalized)
    normal_tex:      vec3f,  // テクスチャサンプル値 [0, 1]³
    normal_strength: f32,    // 法線強度 (0 = 平坦, 1 = そのまま, >1 = 強調)
) -> ShadingContext {
    var ctx: ShadingContext;
    // ----------------------------------------------------------------
    //  1. TBN 基底を構築
    //     tangent_w でバイタンジェントのハンドネスを正しく反転
    // ----------------------------------------------------------------
    let B = normalize(cross(N, T)) * tangent_w;
    // ----------------------------------------------------------------
    //  2. 法線マップをタンジェント空間ベクトルにデコード
    //     [0, 1] → [-1, 1]
    // ----------------------------------------------------------------
    var tn = normal_tex * 2.0 - vec3f(1.0);
    // ----------------------------------------------------------------
    //  3. 強度スケーリング
    //     XY 成分を strength 倍にすることで法線の傾きを調整
    //     strength = 0 → tn = (0, 0, 1) = 完全に平坦
    //     strength = 1 → テクスチャそのまま
    //     strength > 1 → 法線を強調 (Blender の "Strength" と同義)
    // ----------------------------------------------------------------
    tn = vec3f(tn.xy * normal_strength, tn.z);
    // Z が 0 になることを防ぐ (Z 再計算オプション)
    // Blender は XY から Z を再導出する派生モードもあるが
    // 通常テクスチャにはすでに正しい Z が格納されているため normalize で十分
    let tn_n = normalize(tn);
    // ----------------------------------------------------------------
    //  4. タンジェント空間 → ワールド空間へ変換 (TBN × tn)
    //        | T.x  B.x  N.x |   | tn.x |
    //        | T.y  B.y  N.y | × | tn.y |
    //        | T.z  B.z  N.z |   | tn.z |
    // ----------------------------------------------------------------
    let N_perturbed = normalize(tn_n.x * T + tn_n.y * B + tn_n.z * N);
    ctx.Ng    = N;            // 幾何法線（バックフェース判定・Clearcoat 等で使用）
    ctx.N     = N_perturbed;  // シェーディング法線（BRDF の全計算に使用）
    ctx.T     = T;
    ctx.B     = B;
    ctx.V     = V;
    ctx.L     = L;
    ctx.H     = normalize(V + L);
    ctx.NdotL = max(dot(N_perturbed, L), 1e-4);
    ctx.NdotV = max(dot(N_perturbed, V), 1e-4);
    ctx.NdotH = max(dot(N_perturbed, ctx.H), 1e-4);
    ctx.LdotH = max(dot(L, ctx.H), 1e-4);
    ctx.VdotH = max(dot(V, ctx.H), 1e-4);
    return ctx;
}

// ================================================================
//  ユーティリティ
// ================================================================

fn pow2(x: f32) -> f32 { return x * x; }
fn pow4(x: f32) -> f32 { let x2 = x * x; return x2 * x2; }
fn pow5(x: f32) -> f32 { return pow4(x) * x; }

fn luminance(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

// 色をティントカラーに変換（輝度で正規化）
fn color_to_tint(c: vec3f) -> vec3f {
  let lum = luminance(c);
  return select(vec3f(1.0), c / lum, lum > EPS);
}

// ================================================================
//  フレネル (Schlick 近似)
// ================================================================

// スカラー F0 のフレネル
fn fresnel_schlick_f32(f0: f32, cos_theta: f32) -> f32 {
  return f0 + (1.0 - f0) * pow5(1.0 - cos_theta);
}

// ベクトル F0 のフレネル
fn fresnel_schlick(f0: vec3f, cos_theta: f32) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow5(1.0 - cos_theta);
}

// IOR から F0 を計算（界面の法線反射率）
fn ior_to_f0(ior: f32) -> f32 {
  let r = (ior - 1.0) / (ior + 1.0);
  return r * r;
}

// F0 から IOR を逆算
fn f0_to_ior(f0: f32) -> f32 {
  let r = sqrt(f0);
  return (1.0 + r) / (1.0 - r + EPS);
}

// ================================================================
//  GGX 法線分布関数 (NDF) — Trowbridge-Reitz
// ================================================================

// 等方性 GGX NDF
// α = roughness²  (Blender は perceptual roughness を使用)
fn ndf_ggx(NdotH: f32, alpha: f32) -> f32 {
  let a2 = alpha * alpha;
  let denom = pow2(NdotH * NdotH * (a2 - 1.0) + 1.0);
  return a2 / (PI * denom + EPS);
}

// 異方性 GGX NDF (Burley 2012)
// ax, ay: tangent / bitangent 方向の roughness
fn ndf_ggx_aniso(H: vec3f, T: vec3f, B: vec3f, N: vec3f, ax: f32, ay: f32) -> f32 {
  let TdotH = dot(T, H);
  let BdotH = dot(B, H);
  let NdotH = dot(N, H);
  let denom = pow2(TdotH / ax) + pow2(BdotH / ay) + NdotH * NdotH;
  return 1.0 / (PI * ax * ay * denom * denom + EPS);
}

// ================================================================
//  Smith マスキング・シャドウイング関数 G
// ================================================================

// Smith GGX の Lambda 関数
fn smith_lambda_ggx(NdotW: f32, alpha: f32) -> f32 {
  let a2 = alpha * alpha;
  let NdotW2 = NdotW * NdotW;
  return (-1.0 + sqrt(1.0 + a2 * (1.0 - NdotW2) / (NdotW2 + EPS))) * 0.5;
}

// 高さ相関 Smith G2（最も精度が高い形）
fn smith_g2_ggx(NdotL: f32, NdotV: f32, alpha: f32) -> f32 {
  let lambdaL = smith_lambda_ggx(NdotL, alpha);
  let lambdaV = smith_lambda_ggx(NdotV, alpha);
  return 1.0 / (1.0 + lambdaL + lambdaV);
}

// 異方性 Smith G1
fn smith_g1_ggx_aniso(NdotW: f32, WdotT: f32, WdotB: f32, ax: f32, ay: f32) -> f32 {
  let a2 = pow2(WdotT * ax) + pow2(WdotB * ay);
  let NdotW2 = NdotW * NdotW;
  return 2.0 * NdotW / (NdotW + sqrt(NdotW2 + a2 * (1.0 - NdotW2) / (NdotW2 + EPS)));
}

// ================================================================
//  Disney Diffuse（ラフネス依存の Lambert 変形）
// ================================================================
// Burley 2012: "Physically Based Shading at Disney"
fn disney_diffuse(mat: PrincipledMaterial, ctx: ShadingContext) -> vec3f {
  // Burley 2012 原文: f_retro は roughness（線形）を使う
  let f_retro = 2.0 * mat.roughness * ctx.LdotH * ctx.LdotH;
  let f_d90   = 0.5 + f_retro;
  let fl      = pow5(1.0 - ctx.NdotL);
  let fv      = pow5(1.0 - ctx.NdotV);
  let f_d     = (1.0 + (f_d90 - 1.0) * fl) * (1.0 + (f_d90 - 1.0) * fv);

  // サブサーフェス近似
  let f_ss90 = mat.roughness * ctx.LdotH * ctx.LdotH;
  let f_ss   = (1.0 + (f_ss90 - 1.0) * fl) * (1.0 + (f_ss90 - 1.0) * fv);
  let sum    = max(ctx.NdotL + ctx.NdotV, 0.001);
  let ss     = 1.25 * (f_ss * (1.0 / sum - 0.5) + 0.5);

  let diffuse_color = mix(mat.base_color, mat.subsurface_color, mat.subsurface);
  let diffuse_val   = mix(f_d, ss, mat.subsurface) * INV_PI;

  return diffuse_color * diffuse_val;
}

// ================================================================
//  等方性 GGX スペキュラー BRDF
// ================================================================
fn specular_brdf_iso(
  mat: PrincipledMaterial,
  ctx: ShadingContext,
  f0: vec3f,
  alpha: f32
) -> vec3f {
  let D = ndf_ggx(ctx.NdotH, alpha);
  let G = smith_g2_ggx(ctx.NdotL, ctx.NdotV, alpha);
  let F = fresnel_schlick(f0, ctx.VdotH);
  // Cook-Torrance 分母
  let denom = 4.0 * ctx.NdotL * ctx.NdotV + EPS;
  return (D * G * F) / denom;
}

// ================================================================
//  異方性 GGX スペキュラー BRDF
// ================================================================

fn specular_brdf_aniso(
  mat: PrincipledMaterial,
  ctx: ShadingContext,
  f0: vec3f,
  ax: f32,
  ay: f32
) -> vec3f {
  let D  = ndf_ggx_aniso(ctx.H, ctx.T, ctx.B, ctx.N, ax, ay);
  let g1L = smith_g1_ggx_aniso(ctx.NdotL, dot(ctx.L, ctx.T), dot(ctx.L, ctx.B), ax, ay);
  let g1V = smith_g1_ggx_aniso(ctx.NdotV, dot(ctx.V, ctx.T), dot(ctx.V, ctx.B), ax, ay);
  let G  = g1L * g1V;
  let F  = fresnel_schlick(f0, ctx.VdotH);
  let denom = 4.0 * ctx.NdotL * ctx.NdotV + EPS;
  return (D * G * F) / denom;
}

// ================================================================
//  Sheen（布・ファブリック向け端部ハイライト）
// ================================================================
// Blender 4.x は Charlie NDF を使用。ここでは Burley Sheen で近似。

fn sheen_brdf(mat: PrincipledMaterial, ctx: ShadingContext) -> vec3f {
  if (mat.sheen < EPS) { return vec3f(0.0); }

  // Charlie NDF (簡易版: inverted Gaussian)
  let sin_theta_h = sqrt(max(0.0, 1.0 - ctx.NdotH * ctx.NdotH));
  let inv_r = 1.0 / max(mat.sheen_roughness, EPS);
  let D = (2.0 + inv_r) * pow(sin_theta_h, inv_r) * INV_PI * 0.5;

  // シーンティントカラー
  let tint = color_to_tint(mat.base_color);
  let c_sheen = mix(vec3f(1.0), tint, mat.sheen_tint);

  // Fuzz の端部効果: (1 - |L·H|)^5
  let f_sheen = pow5(1.0 - ctx.LdotH);

  // 可視性項（近似: 1 / (NdotL + NdotV - NdotL*NdotV) ）
  let V_vis = 1.0 / (ctx.NdotL + ctx.NdotV - ctx.NdotL * ctx.NdotV + EPS);

  return mat.sheen * c_sheen * f_sheen * D * V_vis;
}

// ================================================================
//  Clearcoat（ラッカー層）
// ================================================================
// IOR=1.5 固定 → F0=0.04、薄い GGX ローブ

fn clearcoat_brdf(mat: PrincipledMaterial, ctx: ShadingContext) -> f32 {
  if (mat.clearcoat < EPS) { return 0.0; }

  // Blender: alpha_cc = mix(0.1, 0.001, (1-clearcoat_roughness)^2) → Blenderは別の変換
  // 簡易: alpha_cc = clearcoat_roughness^2, clamp to [0.001, 1]
  let alpha_cc = max(mat.clearcoat_roughness * mat.clearcoat_roughness, 0.001);
  let D  = ndf_ggx(ctx.NdotH, alpha_cc);
  let G  = smith_g2_ggx(ctx.NdotL, ctx.NdotV, alpha_cc);
  let F  = fresnel_schlick_f32(ior_to_f0(mat.clearcoat_ior), ctx.VdotH); // IOR=1.5 → F0=0.04
  let denom = 4.0 * ctx.NdotL * ctx.NdotV + EPS;
  return mat.clearcoat * 0.25 * (D * G * F) / denom;
}

// ================================================================
//  スペキュラー F0 の計算
//  メタリックとスペキュラーティントを考慮
// ================================================================

fn compute_specular_f0(mat: PrincipledMaterial) -> vec3f {
  // 誘電体の F0: IOR から算出 + ティント
  let f0_dielectric = ior_to_f0(mat.ior);
  // スペキュラーティント: base_color の色相を F0 に混合
  let tint = color_to_tint(mat.base_color);
  let specular_color = mix(vec3f(f0_dielectric), tint * f0_dielectric, mat.specular_tint);

  // メタリック: base_color を F0 に（金属は F0 が高く着色される）
  return mix(specular_color, mat.base_color, mat.metallic);
}

// ================================================================
//  異方性 roughness の計算
//  Blender: aspect = sqrt(1 - 0.9 * anisotropic)
//           ax = roughness^2 / aspect
//           ay = roughness^2 * aspect
// ================================================================

struct AnisoAlpha {
  ax: f32,
  ay: f32,
}

fn compute_aniso_alpha(mat: PrincipledMaterial) -> AnisoAlpha {
  let r2     = mat.roughness * mat.roughness;
  let aspect = sqrt(1.0 - 0.9 * mat.anisotropic);
  var aa: AnisoAlpha;
  aa.ax = max(r2 / aspect, 0.001);
  aa.ay = max(r2 * aspect, 0.001);
  return aa;
}

// ================================================================
//  メイン Principled BSDF 評価関数
//  戻り値: BRDF × NdotL（ライティング積み）の反射輝度
// ================================================================
fn principled_bsdf_eval(
  mat: PrincipledMaterial,
  ctx: ShadingContext
) -> vec3f {
  // 幾何法線で裏面判定（法線マップによる偽陰にならないよう Ng を使う）
  let geo_NdotL = dot(ctx.Ng, ctx.L);
  let geo_NdotV = dot(ctx.Ng, ctx.V);
  let ambient = vec3f(0.2) * mat.base_color;
  if (geo_NdotL <= 0.0 || geo_NdotV <= 0.0) {
    return mat.emission * mat.emission_strength + ambient;
  }

  // ---- Specular F0 ----
  let f0 = compute_specular_f0(mat);

  // ---- Specular BRDF ----
  var specular: vec3f;
  if (mat.anisotropic > EPS) {
    let aa = compute_aniso_alpha(mat);
    specular = specular_brdf_aniso(mat, ctx, f0, aa.ax, aa.ay);
  } else {
    let alpha = max(mat.roughness * mat.roughness, 0.001);
    specular = specular_brdf_iso(mat, ctx, f0, alpha);
  }

  // ---- Diffuse ----
  let F_diffuse     = fresnel_schlick(f0, ctx.VdotH);
  let diffuse_weight = (1.0 - mat.metallic) * (1.0 - mat.transmission);
  let diffuse        = disney_diffuse(mat, ctx) * (vec3f(1.0) - F_diffuse) * diffuse_weight;

  // ---- Sheen ----
  let sheen = sheen_brdf(mat, ctx) * (1.0 - mat.metallic);

  // ---- Clearcoat ----
  let clearcoat = clearcoat_brdf(mat, ctx);

  // ---- 層合成 ----
  let cc_f         = fresnel_schlick_f32(0.04, ctx.VdotH) * mat.clearcoat * 0.25;
  let layer_weight = 1.0 - cc_f;

  var result = (diffuse + sheen + specular) * layer_weight + vec3f(clearcoat);

  // NdotL はシェーディング法線を使う（クランプ済み）
  result *= ctx.NdotL;

  // ---- Emission ----
  result += mat.emission * mat.emission_strength;

  result += ambient;

  return result;
}

// ================================================================
//  透過 BSDF（簡易：屈折・GGX）
//  transmission > 0 の場合に使用
// ================================================================

fn transmission_bsdf(
  mat: PrincipledMaterial,
  N: vec3f,
  V: vec3f,
  L: vec3f  // 屈折後の透過方向（負の方向から入射するイメージ）
) -> vec3f {
  // 屈折先の GGX NDF (等方性)
  let alpha   = max(mat.roughness * mat.roughness, 0.001);
  let H_t     = -normalize(mat.ior * L + V); // 透過ハーフベクトル
  let NdotH   = saturate(dot(N, H_t));
  let NdotL   = abs(dot(N, L));
  let NdotV   = saturate(dot(N, V));
  let LdotH   = abs(dot(L, H_t));
  let VdotH   = saturate(dot(V, H_t));

  let D = ndf_ggx(NdotH, alpha);
  let G = smith_g2_ggx(NdotL, NdotV, alpha);

  // 透過フレネル（Schlick）
  let f0 = ior_to_f0(mat.ior);
  let F  = 1.0 - fresnel_schlick_f32(f0, VdotH);

  // 透過 BTDF の分母（eta²）
  let eta     = mat.ior;
  let dot_sum = VdotH + eta * LdotH;
  let weight  = (LdotH * VdotH) / (NdotL * NdotV + EPS);
  let btdf    = weight * D * G * F * eta * eta / (dot_sum * dot_sum + EPS);

  return mat.base_color * btdf * mat.transmission;
}

// ================================================================
//  サンプリング用ヘルパー（IBL / パストレ向け）
// ================================================================

// GGX 重点サンプリング — ハーフベクトルを生成
// xi: ランダム [0,1)² の一様乱数
fn sample_ggx_vndf(xi: vec2f, alpha: f32, V_local: vec3f) -> vec3f {
  // Heitz 2018: "Sampling the GGX Distribution of Visible Normals"
  let a2    = alpha;
  let Vh    = normalize(vec3f(a2 * V_local.x, a2 * V_local.y, V_local.z));
  let len2  = Vh.x * Vh.x + Vh.y * Vh.y;
  let T1    = select(vec3f(1.0, 0.0, 0.0),
                      vec3f(-Vh.y, Vh.x, 0.0) / sqrt(len2),
                      len2 > EPS);
  let T2    = cross(Vh, T1);

  let r   = sqrt(xi.x);
  let phi = 2.0 * PI * xi.y;
  let t1  = r * cos(phi);
  var t2  = r * sin(phi);
  let s   = 0.5 * (1.0 + Vh.z);
  t2      = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

  let Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1*t1 - t2*t2)) * Vh;
  return normalize(vec3f(a2 * Nh.x, a2 * Nh.y, max(0.0, Nh.z)));
}

// Lambert 半球サンプリング（コサイン重点）
fn sample_cosine_hemisphere(xi: vec2f) -> vec3f {
  let phi   = 2.0 * PI * xi.x;
  let r     = sqrt(xi.y);
  return vec3f(r * cos(phi), r * sin(phi), sqrt(max(0.0, 1.0 - xi.y)));
}

// タンジェント空間 → ワールド空間変換
fn tangent_to_world(v: vec3f, N: vec3f, T: vec3f, B: vec3f) -> vec3f {
  return v.x * T + v.y * B + v.z * N;
}

// ================================================================
//  IBL（環境マップ）近似評価
//  事前計算した BRDF LUT を使用する split-sum 近似
// ================================================================

// Karis 2013 の split-sum 近似
// brdf_lut: BRDF 積分テクスチャ (roughness, NdotV) → (scale, bias)
fn eval_ibl(
  mat:      PrincipledMaterial,
  N:        vec3f,
  V:        vec3f,
  env_spec: vec3f,  // 事前フィルタ済みスペキュラー環境色
  env_diff: vec3f,  // 拡散 irradiance
  brdf_lut: vec2f   // テクスチャルックアップ結果 (scale, bias)
) -> vec3f {
  let NdotV  = saturate(dot(N, V));
  let f0     = compute_specular_f0(mat);
  let alpha  = mat.roughness * mat.roughness;

  // スペキュラー（split-sum）
  let spec   = (f0 * brdf_lut.x + brdf_lut.y) * env_spec;

  // 拡散（Lambertian irradiance）
  let diff_w = (1.0 - mat.metallic) * (1.0 - mat.transmission);
  let diff   = mat.base_color * env_diff * diff_w * INV_PI;

  // シーン（IBL では端部効果が弱いため係数を下げる）
  let tint    = color_to_tint(mat.base_color);
  let c_sheen = mix(vec3f(1.0), tint, mat.sheen_tint);
  let sheen   = c_sheen * mat.sheen * 0.2 * env_diff;

  // クリアコート（固定 IOR=1.5）
  let cc_f0   = 0.04;
  let cc_spec = (cc_f0 * brdf_lut.x + brdf_lut.y) * env_spec;
  let cc      = mat.clearcoat * 0.25 * cc_spec;

  return diff + sheen + spec + cc + mat.emission * mat.emission_strength;
}

// ================================================================
//  BRDF LUT ベイク用シェーダー（事前計算）
//  UV.x = roughness, UV.y = NdotV
//  出力: (BRDF scale, BRDF bias) を R8G8 テクスチャへ
// ================================================================

fn integrate_brdf(roughness: f32, NdotV: f32, num_samples: u32) -> vec2f {
  let alpha = roughness * roughness;
  let V = vec3f(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);
  let N = vec3f(0.0, 0.0, 1.0);

  var scale = 0.0;
  var bias  = 0.0;
  let inv_n = 1.0 / f32(num_samples);

  for (var i: u32 = 0u; i < num_samples; i++) {
    // Hammersley 列（疑似ランダム）
    var bits = (i << 16u) | (i >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    let xi = vec2f(f32(i) * inv_n, f32(bits) * 2.3283064365386963e-10);

    let H_local = sample_ggx_vndf(xi, alpha, V);
    let L       = normalize(reflect(-V, H_local));
    let NdotL   = saturate(L.z);
    let NdotH   = saturate(H_local.z);
    let VdotH   = saturate(dot(V, H_local));

    if (NdotL > 0.0) {
      let G       = smith_g2_ggx(NdotL, NdotV, alpha);
      let G_vis   = G * VdotH / (NdotH * NdotV + EPS);
      let Fc      = pow5(1.0 - VdotH);
      scale += (1.0 - Fc) * G_vis;
      bias  += Fc * G_vis;
    }
  }
  return vec2f(scale, bias) * inv_n;
}
