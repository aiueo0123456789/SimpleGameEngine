import EngineTransform;

struct CameraConfig {
  near: f32,
  far: f32,
  padding: vec2<f32>,
}
struct EngineCamera {
  config: CameraConfig,
  transform: EngineTransform,
  pM: mat4x4<f32>,
  vM: mat4x4<f32>,
  vpM: mat4x4<f32>,
  ivpM: mat4x4<f32>,
}