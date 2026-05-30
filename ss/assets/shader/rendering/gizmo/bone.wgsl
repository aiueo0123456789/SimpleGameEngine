ShaderSetting {
  depthCompare: always,
  depthWrite: false,
  topologyType: list,
  culling: none,
}

import EngineCamera;

struct Bone {
  position: vec4<f32>,
  rotation: vec4<f32>,
  scale: vec3<f32>,
  lenght: f32,
}

@bind(<uniform> camera: EngineCamera);
@bind(<storage, read> bones: array<Bone>);

struct VInput {
  @builtin(instance_index) instanceIndex: u32,
  @builtin(vertex_index) vertexIndex: u32,
}

struct VOutput {
  @builtin(position) position: vec4<f32>,
};

// クォータニオン(xyzw) → 回転行列(mat3x3)
fn quat_to_mat3(q: vec4<f32>) -> mat3x3<f32> {
  let x = q.x; let y = q.y; let z = q.z; let w = q.w;

  let x2 = x + x; let y2 = y + y; let z2 = z + z;
  let xx = x * x2; let xy = x * y2; let xz = x * z2;
  let yy = y * y2; let yz = y * z2; let zz = z * z2;
  let wx = w * x2; let wy = w * y2; let wz = w * z2;

  return mat3x3<f32>(
    vec3<f32>(1.0 - (yy + zz),        xy + wz,         xz - wy),
    vec3<f32>(      xy - wz,     1.0 - (xx + zz),       yz + wx),
    vec3<f32>(      xz + wy,           yz - wx,   1.0 - (xx + yy)),
  );
}

fn bone_to_matrix(bone: Bone) -> mat4x4<f32> {
  let rot = quat_to_mat3(bone.rotation);
  let scale = bone.scale;

  let c0 = vec4<f32>(rot[0] * scale, 0.0);
  let c1 = vec4<f32>(rot[1] * scale, 0.0);
  let c2 = vec4<f32>(rot[2] * scale, 0.0);
  let c3 = vec4<f32>(bone.position.xyz,  1.0);

  return mat4x4<f32>(c0, c1, c2, c3);
}

@vertex
fn vmain(input : VInput) -> VOutput {
  let instanceIndex = input.instanceIndex;
  let vertexIndex = input.vertexIndex % 6u;
  var output : VOutput;
  let bone = bones[instanceIndex];
  var point = vec4<f32>(0.0);
  if (vertexIndex < 3) {
    if (vertexIndex == 0u) {
      point = vec4<f32>(0.1, 0.0, 0.0, 1.0);
    } else if (vertexIndex == 1u) {
      point = vec4<f32>(0.0, 0.0, bone.lenght, 1.0);
    } else if (vertexIndex == 2u) {
      point = vec4<f32>(-0.1, 0.0, 0.0, 1.0);
    }
  } else {
    if (vertexIndex == 3u) {
      point = vec4<f32>(0.0, 0.1, 0.0, 1.0);
    } else if (vertexIndex == 4u) {
      point = vec4<f32>(0.0, 0.0, bone.lenght, 1.0);
    } else if (vertexIndex == 5u) {
      point = vec4<f32>(0.0, -0.1, 0.0, 1.0);
    }
  }
  point = bone_to_matrix(bone) * point;
  output.position = camera.vpM * point;
  return output;
}

struct FOutput {
  @location(0) color: vec4<f32>,
}

@fragment
fn fmain() -> FOutput {
  var output : FOutput;
  output.color = vec4<f32>(0.0, 0.0, 1.0, 1.0);
  return output;
}