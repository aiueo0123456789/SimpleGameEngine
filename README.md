# SimpleGameEngine

SimpleGameEngine is a WebGPU-based game engine written in JavaScript.

This engine is designed around a component-system architecture inspired by engines such as Unity. It focuses on giving developers direct control over rendering and engine behavior while remaining flexible and extensible.

## Requirements

To use this engine, knowledge of the following technologies is recommended:

- JavaScript
- WGSL (WebGPU Shading Language)
- WebGPU

The engine also uses webgpumatrix for vector, matrix, and quaternion calculations.

---

## Features

### Animation

- Bone Animation
- Animation State Machine (similar to Unity Animator)
- Skinning
- Inverse Kinematics (IK)

### Rendering

- WebGPU Renderer
- Post Processing
- Skybox
- Fog
- Gizmos

### Architecture

- Component-based design
- System-based update architecture
- Scene hierarchy

---

## Current Status

### Implemented

- ✅ Bone Animation
- ✅ Animator State Transitions
- ✅ Skinning
- ✅ Post Processing
- ✅ Gizmos
- ✅ Inverse Kinematics (IK)
- ✅ Skybox
- ✅ Fog

### Planned / In Progress

- 🚧 UI Rendering System
- 🚧 Morph Targets
- 🚧 Proper Transparency Rendering
- 🚧 More Complete Physics System

---

## Known Limitations

### Transparency

Transparent objects are supported, but rendering order and blending are not yet fully correct in all situations.

### Physics

The current physics implementation is experimental and simplified. A more complete physics system is planned.

---

## Getting Started

Documentation is currently being written.

A tutorial game project is under development and will serve as the primary learning resource for the engine.

---

## Dependencies

### webgpumatrix

The engine relies on webgpumatrix for matrix and vector operations.

---

## Goals

SimpleGameEngine aims to provide:

- A lightweight WebGPU game engine
- Unity-inspired workflow
- Modern rendering features
- Full control through JavaScript and WGSL
- A platform for experimentation and learning graphics programming

---

## License

MIT License