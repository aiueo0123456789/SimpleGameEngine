import EngineTransform;

struct LightConfig {
  near: f32,
  far: f32,
  padding: vec2<f32>,
}
struct EngineLight {
  config: LightConfig,
  transform: EngineTransform,
  pM: mat4x4<f32>,
  vM: mat4x4<f32>,
  vpM: mat4x4<f32>,
  ivpM: mat4x4<f32>,
  color: vec3<f32>,
  intensity: f32,
}