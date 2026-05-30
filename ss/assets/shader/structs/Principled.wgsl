struct PrincipledMaterial {
  // --- Diffuse ---
  base_color:           vec3f, // ベースカラー
  // --- Metallic / Specular ---
  metallic:             f32,   // メタリック [0,1]
  ior:                  f32,   // 屈折率 (デフォルト 1.5)
  specular_tint:        f32,   // スペキュラーティント [0,1]
  // --- Roughness ---
  roughness:            f32,   // 表面粗さ [0,1]
  anisotropic:          f32,   // 異方性 [0,1]
  anisotropic_rotation: f32,   // 異方性回転 [0,1]
  // --- Sheen ---
  sheen:                f32,   // シーン強度 [0,1]
  sheen_roughness:      f32,   // シーン粗さ [0,1]
  sheen_tint:           f32, // シーンティントカラー
  // --- Clearcoat ---
  clearcoat:            f32,   // クリアコート強度 [0,1]
  clearcoat_roughness:  f32,   // クリアコート粗さ [0,1]
  clearcoat_ior:  f32,   // クリアコート粗さ [0,1]
  // --- Transmission ---
  transmission:         f32,   // 透過率 [0,1]
  // --- Subsurface (simplified single-scatter approximation) ---
  subsurface:           f32,   // サブサーフェス重み [0,1]
  subsurface_color:     vec3f, // サブサーフェスカラー
  // --- Emission ---
  emission:             vec3f, // 放射カラー
  emission_strength:    f32,   // 放射強度
  // --- Alpha ---
  alpha:                f32,   // 不透明度 [0,1]
}

struct ShadingContext {
  Ng: vec3f,  // 幾何法線（法線マップ適用前）
  N:  vec3f,  // シェーディング法線（法線マップ適用後）
  T:  vec3f,
  B:  vec3f,
  V:  vec3f,
  L:  vec3f,
  H:  vec3f,
  NdotL: f32,
  NdotV: f32,
  NdotH: f32,
  LdotH: f32,
  VdotH: f32,
}