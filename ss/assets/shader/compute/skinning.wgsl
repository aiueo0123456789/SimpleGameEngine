@group(0) @binding(0) var<storage, read> bindPosesMatrices: array<mat4x4<f32>>;
@group(0) @binding(1) var<storage, read> posesMatrices: array<mat4x4<f32>>;
@group(0) @binding(2) var<storage, read> skinIndexs: array<vec4<u32>>;
@group(0) @binding(3) var<storage, read> skinWeights: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> vertices: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> normals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> tangents: array<vec4<f32>>;

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

fn extract3x3(matrix: mat4x4<f32>) -> mat3x3<f32> {
    return mat3x3<f32>(
        matrix[0].xyz,
        matrix[1].xyz,
        matrix[2].xyz
    );
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertexIndex = global_id.x;
    if (arrayLength(&vertices) <= vertexIndex) {
        return ;
    }
    let baseVertex = vertices[vertexIndex];
    let baseNormal = normals[vertexIndex].xyz;
    let baseTangent = tangents[vertexIndex].xyz;

    var skinnedPosition = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    var skinnedNormal = vec3<f32>(0.0, 0.0, 0.0);
    var skinnedTangent = vec3<f32>(0.0, 0.0, 0.0);
    for (var i = 0u; i < 4u; i = i + 1u) {
        let weight = skinWeights[vertexIndex][i];
        if (0.0 < weight) {
            let boneIndex = skinIndexs[vertexIndex][i];

            let skinningMatrix = posesMatrices[boneIndex] * bindPosesMatrices[boneIndex];
            // 頂点の位置をスキニング
            skinnedPosition += weight * (skinningMatrix * baseVertex);

            let forNormalAndTangent = transpose(inverse3x3(extract3x3(skinningMatrix)));
            // 頂点の法線をスキニング
            skinnedNormal += weight * (forNormalAndTangent * baseNormal);
            skinnedTangent += weight * (forNormalAndTangent * baseTangent);
        }
    }

    vertices[vertexIndex] = skinnedPosition;
    normals[vertexIndex] = vec4<f32>(skinnedNormal, 1.0);
    tangents[vertexIndex] = vec4<f32>(skinnedTangent, 1.0);
}