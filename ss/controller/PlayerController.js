import { quat, vec3, vec4 } from "../../webgpuMatrix.js";
import { Material } from "../assetsManager/MaterialManager.js";
import { Animator } from "../component/Animator.js";
import { Armature } from "../component/Armature.js";
import { BoxCollider } from "../component/BoxCollider.js";
import { Camera } from "../component/camera.js";
import { MeshRenderer } from "../component/MeshRenderer.js";
import { Plane } from "../component/plane/Plane.js";
import { Rigidbody } from "../component/Rigidbody.js";
import { Skinning } from "../component/Skinning.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";
import { Gizmo } from "../develop/Gizmo/Gizmo.js";
import { Gizmo_Triangle } from "../develop/Gizmo/shape/Gizmo_Triangle.js";
import { InputManager } from "../manager/InputManager.js";
import { GameObject } from "../objects/GameObject.js";
import { PhysicsSystem } from "../system/PhysicsSystem.js";
import { math2 } from "../utils/Math2.js";
import { createQuatFromEulerZXY, radFromDeg } from "../utils/util.js";
import { GPU } from "../utils/webGPU.js";

function createQuatFromVec3(vec) {
  // 向かせたい方向
  const dir = vec3.normalize(vec);
  // モデルの元の前方向
  const forward = vec3.create(0, 0, 1);
  // 回転軸
  const axis = vec3.normalize(vec3.cross(forward, dir));
  // 角度
  const dot = vec3.dot(forward, dir);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  // クォータニオン生成
  return quat.fromAxisAngle(axis, angle);
}

export class PlayerController {
  constructor(/** @type {Engine} */ engine) {
    /** @type {PhysicsSystem} */
    this.physicsSystem = engine.getSystem(PhysicsSystem);
    /** @type {InputManager} */
    this.input = engine.getManager(InputManager);
    /** @type {Camera} */
    this.mainCamera = engine.scene.getComponents(Camera)[0];
    /** @type {GameObject} */
    this.playerArmGameObject = engine.scene.getObjectByID("player_arm");
    this.JetEngineVFX1GameObject = engine.scene.getObjectByID("JetEngineVFX");
    this.gizmo = engine.develop.createGizmo();
    engine.develop.appendGizmo(this.gizmo);

    this.isGearDown = true;
  }

  update() {
    /** @type {Transform} */
    const JetEngineVFX1transform =
      this.JetEngineVFX1GameObject.getComponent(Transform);
    /** @type {Transform} */
    const transform = this.playerArmGameObject.getComponent(Transform);
    /** @type {Rigidbody} */
    const rb = this.playerArmGameObject.getComponent(Rigidbody);
    /** @type {Skinning} */
    const skinning = this.playerArmGameObject.getComponent(Skinning);
    /** @type {MeshRenderer} */
    const meshRenderer = this.playerArmGameObject.getComponent(MeshRenderer);
    /** @type {Armature} */
    const armature = skinning.armature;
    /** @type {Animator} */
    const animator = armature.gameObject.getComponent(Animator);
    /** @type {Plane} */
    const plane = armature.gameObject.getComponent(Plane);

    animator.setParameter("isWalking", false);

    for (const subMesh of meshRenderer.subMeshes) {
      if (subMesh.material.name == "face") {
        GPU.writeBuffer(
          subMesh.material.getProperty("faceForward"),
          GPU.createBitData(armature.bones[474].getWorldForward(), ["f32"]),
        );
        GPU.writeBuffer(
          subMesh.material.getProperty("faceRight"),
          GPU.createBitData(armature.bones[474].getWorldRight(), ["f32"]),
        );
      }
      if (subMesh.material.name == "eye") {
        GPU.writeBuffer(
          subMesh.material.getProperty("faceForward"),
          GPU.createBitData(armature.bones[474].getWorldForward(), ["f32"]),
        );
      }
    }

    if (this.input.getKey("KeyZ")) {
      animator.setParameter("isWalking", true);
      plane.throttle += 0.005;
    }
    if (this.input.getKey("KeyX")) {
      animator.setParameter("isWalking", true);
      plane.throttle -= 0.005;
    }
    let flapInputs = [
      0,
      0,
      0,
      0, // ウィング・フラップ

      0,
      0, // エレベーター

      0, // スタビライザー
    ];
    if (this.input.getKey("KeyA")) {
      flapInputs[0] = -1;
      flapInputs[1] = 1;
    }
    if (this.input.getKey("KeyD")) {
      flapInputs[0] = 1;
      flapInputs[1] = -1;
    }
    if (this.input.getKey("KeyW")) {
      flapInputs[4] = 0.5;
      flapInputs[5] = 0.5;
    }
    if (this.input.getKey("KeyS")) {
      flapInputs[4] = -0.5;
      flapInputs[5] = -0.5;
    }
    if (this.input.getKeyDown("KeyF")) {
      if (this.isGearDown) {
        console.log("ギアを上げる")
        animator.setParameter("GearUp", true);
        this.isGearDown = false;
      } else {
        console.log("ギアを下げる")
        animator.setParameter("GearDown", true);
        this.isGearDown = true;
      }
    } else {
      animator.setParameter("GearUp", false);
      animator.setParameter("GearDown", false);
    }
    for (let i = 0; i < plane.aerodynamicSurfaces.length; i++) {
      const aerodynamicSurface = plane.aerodynamicSurfaces[i];
      aerodynamicSurface.bringCloserFlapAngle(flapInputs[i]);
    }
    plane.throttle = Math.max(0, Math.min(1, plane.throttle));
    rb.addForce(
      vec3.scale(transform.getWorldForward(), plane.maxPower * plane.throttle),
    );
    for (let bi = 0; bi < armature.bones.length; bi++) {
      const bone = armature.bones[bi];
      if (bone.name == "wing.L") {
        animator.dynamicPose.bones[bi].setOrientType("LOCAL");
        animator.dynamicPose.bones[bi].setRotation(
          createQuatFromEulerZXY([
            plane.aerodynamicSurfaces[0].flapAngle,
            0,
            0,
          ]),
        );
      }
      if (bone.name == "wing.R") {
        animator.dynamicPose.bones[bi].setOrientType("LOCAL");
        animator.dynamicPose.bones[bi].setRotation(
          createQuatFromEulerZXY([
            plane.aerodynamicSurfaces[1].flapAngle,
            0,
            0,
          ]),
        );
      }
      if (bone.name == "tail.L") {
        animator.dynamicPose.bones[bi].setOrientType("LOCAL");
        animator.dynamicPose.bones[bi].setRotation(
          createQuatFromEulerZXY([
            plane.aerodynamicSurfaces[4].flapAngle,
            0,
            0,
          ]),
        );
      }
      if (bone.name == "tail.R") {
        animator.dynamicPose.bones[bi].setOrientType("LOCAL");
        animator.dynamicPose.bones[bi].setRotation(
          createQuatFromEulerZXY([
            plane.aerodynamicSurfaces[5].flapAngle,
            0,
            0,
          ]),
        );
      }
      if (bone.name == "engineRoot") {
        JetEngineVFX1transform.setParent(bone);
        JetEngineVFX1transform.setScale([
          math2.lerp(0.8, 0.5, plane.throttle),
          math2.lerp(0.8, 0.5, plane.throttle),
          7,
        ]);
        /** @type {MeshRenderer} */
        const JetEngineVFX1MeshRenderer =
          this.JetEngineVFX1GameObject.getComponent(MeshRenderer);
        for (const subMesh of JetEngineVFX1MeshRenderer.subMeshes) {
          if (subMesh.material.name == "JetEngineVFX_Flames") {
            GPU.writeBuffer(
              subMesh.material.getProperty("scaleAndStrength"),
              GPU.createBitData(
                [...Array.from(JetEngineVFX1transform.scale), plane.throttle],
                ["f32"],
              ),
            );
          }
        }
      } else if (bone.name.startsWith("engine")) {
        animator.dynamicPose.bones[bi].setOrientType("LOCAL");
        animator.dynamicPose.bones[bi].setRotation(
          createQuatFromEulerZXY(radFromDeg([-10 * plane.throttle, 0, 0])),
        );
      }
    }
    if (this.gizmo.shapes.length == 0) {
      for (
        let flapI = 0;
        flapI < plane.aerodynamicSurfaces.length * 3;
        flapI++
      ) {
        this.gizmo.addShape(Gizmo.createShape(Gizmo_Triangle));
      }
    }
    for (let flapI = 0; flapI < plane.aerodynamicSurfaces.length; flapI++) {
      const flap = plane.aerodynamicSurfaces[flapI];
      /** @type {Gizmo_Triangle} */
      const forward_gizmo_Triangle = this.gizmo.shapes[flapI * 3];
      forward_gizmo_Triangle.setColor([0, 1, 0, 1]);
      /** @type {Gizmo_Triangle} */
      const lift_gizmo_Triangle = this.gizmo.shapes[flapI * 3 + 1];
      lift_gizmo_Triangle.setColor([0, 0, 1, 1]);
      /** @type {Gizmo_Triangle} */
      const drag_gizmo_Triangle = this.gizmo.shapes[flapI * 3 + 2];
      drag_gizmo_Triangle.setColor([1, 0, 0, 1]);

      forward_gizmo_Triangle.setVertices([
        vec4.byVec3(vec3.add(flap.transform.getWorldPosition(), [0.1, 0, 0.1])),
        vec4.byVec3(
          vec3.add(flap.transform.getWorldPosition(), [-0.1, 0, -0.1]),
        ),
        vec4.byVec3(vec3.add(flap.transform.getWorldPosition(), flap.fw)),
      ]);
      lift_gizmo_Triangle.setVertices([
        vec4.byVec3(vec3.add(flap.transform.getWorldPosition(), [0.1, 0, 0.1])),
        vec4.byVec3(
          vec3.add(flap.transform.getWorldPosition(), [-0.1, 0, -0.1]),
        ),
        vec4.byVec3(vec3.add(flap.transform.getWorldPosition(), flap.forces)),
      ]);
      drag_gizmo_Triangle.setVertices([
        vec4.byVec3(vec3.add(flap.transform.getWorldPosition(), [0.1, 0, 0.1])),
        vec4.byVec3(
          vec3.add(flap.transform.getWorldPosition(), [-0.1, 0, -0.1]),
        ),
        vec4.byVec3(vec3.add(flap.transform.getWorldPosition(), flap.drag)),
      ]);
    }

    animator.setParameter("random", Math.random());
  }
}
