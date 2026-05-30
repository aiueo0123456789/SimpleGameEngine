fn unpackNormal(textureColor: vec3<f32>) -> vec3<f32> {
  return normalize(textureColor * 2.0 - 1.0);
}

fn surf(input: FInput) -> SurfaceOutput {
  var o: SurfaceOutput;
  o.worldPosition = input.worldPosition;
  o.albedo = sandColor;
  o.alpha = 1.0;

  let TBN = computeTBN(input.normal, input.tangent);
  var N = vec3<f32>(0, 0, 1); // 接空間法線
  N = WavesNormal(abs(input.worldPosition.xz), N, TBN);
  N = sandNormal(abs(input.worldPosition.xz) * 500.0, N);

  o.normal = normalize(TBN * N);
  return o;
}

fn rgbTohsv(c: vec3<f32>) -> vec3<f32> {
  let K = vec4<f32>(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  let p = mix(vec4<f32>(c.bg, K.wz), vec4<f32>(c.gb, K.xy), step(c.b, c.g));
  let q = mix(vec4<f32>(p.xyw, c.r), vec4<f32>(c.r, p.yzx), step(p.x, c.r));
  let d = q.x - min(q.w, q.y);
  let e = 1e-10;
  return vec3<f32>(
    abs(q.z + (q.w - q.y) / (6.0 * d + e)), // H
    d / (q.x + e),                         // S
    q.x                                    // V
  );
}

fn hsvTorgb(c: vec3<f32>) -> vec3<f32> {
  let K = vec4<f32>(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  let p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
}

fn hsvAdjust(
  h: f32,
  s: f32,
  v: f32,
  fac: f32,
  color: vec3<f32>
) -> vec3<f32> {
  var hsv = rgbTohsv(color);
  hsv.x = fract(hsv.x + (h - 0.5));
  hsv.y = clamp(hsv.y * s, 0.0, 1.0);
  hsv.z = hsv.z * v;
  let adjusted = hsvTorgb(hsv);
  return mix(color, adjusted, fac);
}

fn brightnessContrast(
  color: vec3<f32>,
  brightness: f32,
  contrast: f32
) -> vec3<f32> {
  let a = 1.0 + contrast;          // contrastは-1〜1想定
  let b = brightness - contrast * 0.5;
  return a * color + vec3<f32>(b);
}

fn colorLamp(
  colors:  array<vec3<f32>, 4>,
  offsets: array<f32, 4>,
  count:   u32,   // 実際に使うストップ数(2〜4)
  t:       f32
) -> vec3<f32> {
  // countが範囲外なら最後の色を返す
  if (count < 2u) {
    return colors[0];
  }
  if (t <= offsets[0]) {
    return colors[0];
  }
  // 該当区間を探す
  for (var i = 0u; i < count - 1u; i++) {
    if (t <= offsets[i + 1u]) {
      let o1 = offsets[i];
      let o2 = offsets[i + 1u];
      if (abs(o2 - o1) < 1e-10) { return colors[i + 1u]; }
      let factor = saturate((t - o1) / (o2 - o1));
      return mix(colors[i], colors[i + 1u], factor);
    }
  }
  return colors[count - 1u]; // tがoffsets最大値を超えた場合
}

fn colorLampVec4(
  colors:  array<vec4<f32>, 4>,
  offsets: array<f32, 4>,
  count:   u32,   // 実際に使うストップ数(2〜4)
  t:       f32
) -> vec4<f32> {
  // countが範囲外なら最後の色を返す
  if (count < 2u) {
    return colors[0];
  }
  if (t <= offsets[0]) {
    return colors[0];
  }
  // 該当区間を探す
  for (var i = 0u; i < count - 1u; i++) {
    if (t <= offsets[i + 1u]) {
      let o1 = offsets[i];
      let o2 = offsets[i + 1u];
      if (abs(o2 - o1) < 1e-10) { return colors[i + 1u]; }
      let factor = saturate((t - o1) / (o2 - o1));
      return mix(colors[i], colors[i + 1u], factor);
    }
  }
  return colors[count - 1u]; // tがoffsets最大値を超えた場合
}

fn linearToSRGB(c: vec3<f32>) -> vec3<f32> {
  return pow(c, vec3<f32>(1.0 / 2.2));
}

fn computeTBN(N: vec3<f32>, T: vec4<f32>) -> mat3x3<f32> {
  let tangent = normalize(T.xyz);
  let normal = normalize(N);

  // bitangent = cross(N, T) * sign
  let bitangent = normalize(cross(normal, tangent) * T.w);

  return mat3x3<f32>(tangent, bitangent, normal);
}

fn nlerp(n1: vec3<f32>, n2: vec3<f32>, t: f32) -> vec3<f32> {
  return normalize(mix(n1, n2, t));
}

fn normalmap(TBN: mat3x3<f32>, color: vec3<f32>, strength: f32) -> vec3<f32> {
    var n = color * 2.0 - vec3<f32>(1.0);
    n = vec3<f32>(n.xy * strength, n.z);
    return normalize(TBN * n);
}

fn rangeMapping(x: f32, min: f32, max: f32, min_: f32, max_: f32) -> f32 {
  return (x - min) / (max - min) * (max_ - min_) + min_;
}

// blenderのレイヤーウェイト(前方向)
fn getLayerWeight(N: vec3<f32>, VDir: vec3<f32>, blend: f32) -> f32 {
  let facing = 1.0 - saturate(abs(dot(N, VDir)));
  let exp = 1.0 / max(1.0 - blend, 0.00001); // 0除算防止
  return pow(facing, exp);
}

fn cmp(x: f32, t: f32, e: f32) -> f32 {
  return select(0.0, 1.0, abs(x - t) < e);
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

fn specular(
  N: vec3<f32>,
  V: vec3<f32>,
  F0: vec3<f32>,
  roughness: f32
) -> vec3<f32> {
  let L = -light.transform.dir;
  let H = normalize(V + L);
  let NdotL = max(dot(N, L), 0.0);
  let NdotV = max(dot(N, V), 0.0);
  let NdotH = max(dot(N, H), 0.0);
  let VdotH = max(dot(V, H), 0.0);
  // GGX Distribution
  let a = roughness * roughness;
  let a2 = a * a;
  let denom = (NdotH * NdotH * (a2 - 1.0) + 1.0);
  let D = a2 / (3.14159 * denom * denom);
  // Fresnel
  let F = fresnelSchlick(VdotH, F0);
  // Geometry（簡易）
  let k = (roughness + 1.0);
  let k2 = (k * k) / 8.0;
  let Gv = NdotV / (NdotV * (1.0 - k2) + k2);
  let Gl = NdotL / (NdotL * (1.0 - k2) + k2);
  let G = Gv * Gl;
  return (D * F * G) / (4.0 * NdotV * NdotL + 0.0001);
}


fn inverse4x4(m: mat4x4<f32>) -> mat4x4<f32> {
  let a00 = m[0][0];
  let a01 = m[0][1];
  let a02 = m[0][2];
  let a03 = m[0][3];
  let a10 = m[1][0];
  let a11 = m[1][1];
  let a12 = m[1][2];
  let a13 = m[1][3];
  let a20 = m[2][0];
  let a21 = m[2][1];
  let a22 = m[2][2];
  let a23 = m[2][3];
  let a30 = m[3][0];
  let a31 = m[3][1];
  let a32 = m[3][2];
  let a33 = m[3][3];

  let b00 = a00 * a11 - a01 * a10;
  let b01 = a00 * a12 - a02 * a10;
  let b02 = a00 * a13 - a03 * a10;
  let b03 = a01 * a12 - a02 * a11;
  let b04 = a01 * a13 - a03 * a11;
  let b05 = a02 * a13 - a03 * a12;
  let b06 = a20 * a31 - a21 * a30;
  let b07 = a20 * a32 - a22 * a30;
  let b08 = a20 * a33 - a23 * a30;
  let b09 = a21 * a32 - a22 * a31;
  let b10 = a21 * a33 - a23 * a31;
  let b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if det == 0.0 {
    // 逆行列が存在しない場合、単位行列を返す（エラー処理を追加する必要があるかもしれません）
    return mat4x4<f32>(
      vec4<f32>(1.0, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 1.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 1.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
  }

  let inv_det = 1.0 / det;

  return mat4x4<f32>(
    vec4<f32>(
      (a11 * b11 - a12 * b10 + a13 * b09) * inv_det,
      (-a01 * b11 + a02 * b10 - a03 * b09) * inv_det,
      (a31 * b05 - a32 * b04 + a33 * b03) * inv_det,
      (-a21 * b05 + a22 * b04 - a23 * b03) * inv_det
    ),
    vec4<f32>(
      (-a10 * b11 + a12 * b08 - a13 * b07) * inv_det,
      (a00 * b11 - a02 * b08 + a03 * b07) * inv_det,
      (-a30 * b05 + a32 * b02 - a33 * b01) * inv_det,
      (a20 * b05 - a22 * b02 + a23 * b01) * inv_det
    ),
    vec4<f32>(
      (a10 * b10 - a11 * b08 + a13 * b06) * inv_det,
      (-a00 * b10 + a01 * b08 - a03 * b06) * inv_det,
      (a30 * b04 - a31 * b02 + a33 * b00) * inv_det,
      (-a20 * b04 + a21 * b02 - a23 * b00) * inv_det
    ),
    vec4<f32>(
      (-a10 * b09 + a11 * b07 - a12 * b06) * inv_det,
      (a00 * b09 - a01 * b07 + a02 * b06) * inv_det,
      (-a30 * b03 + a31 * b01 - a32 * b00) * inv_det,
      (a20 * b03 - a21 * b01 + a22 * b00) * inv_det
    )
  );
}

fn extract3x3(matrix: mat4x4<f32>) -> mat3x3<f32> {
  return mat3x3<f32>(
    matrix[0].xyz,
    matrix[1].xyz,
    matrix[2].xyz
  );
}

fn inverse3x3(matrix: mat3x3<f32>) -> mat3x3<f32> {
  var inv: mat3x3<f32>;
  let a = matrix[0][0];
  let b = matrix[0][1];
  let c = matrix[0][2];
  let d = matrix[1][0];
  let e = matrix[1][1];
  let f = matrix[1][2];
  let g = matrix[2][0];
  let h = matrix[2][1];
  let i = matrix[2][2];
  let det = a * (e * i - f * h) -
                b * (d * i - f * g) +
                c * (d * h - e * g);
  if (det == 0.0) {
    // 行列が逆行列を持たない場合
    return mat3x3<f32>(0.0, 0.0, 0.0,
                      0.0, 0.0, 0.0,
                      0.0, 0.0, 0.0);
  }
  let invDet = 1.0 / det;
  inv[0][0] = (e * i - f * h) * invDet;
  inv[0][1] = (c * h - b * i) * invDet;
  inv[0][2] = (b * f - c * e) * invDet;
  inv[1][0] = (f * g - d * i) * invDet;
  inv[1][1] = (a * i - c * g) * invDet;
  inv[1][2] = (c * d - a * f) * invDet;
  inv[2][0] = (d * h - e * g) * invDet;
  inv[2][1] = (b * g - a * h) * invDet;
  inv[2][2] = (a * e - b * d) * invDet;
  return inv;
}