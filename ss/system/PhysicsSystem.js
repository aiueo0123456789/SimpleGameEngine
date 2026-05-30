// PhysicsSystem.js の完成版
import { mat4, quat, vec3 } from "../../webgpuMatrix.js";
import { BoxCollider } from "../component/BoxCollider.js";
import { MeshCollider } from "../component/MeshCollider.js";
import { Rigidbody } from "../component/Rigidbody.js";
import { Transform } from "../component/Transform.js";
import { Engine } from "../core/Engine.js";

// ── ユーティリティ ──────────────────────────────────────────

function computeAABBNormal(point, aabbMin, aabbMax) {
  const normals = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
  ];
  const faces = [
    aabbMin[0],
    aabbMax[0],
    aabbMin[1],
    aabbMax[1],
    aabbMin[2],
    aabbMax[2],
  ];
  const coords = [point[0], point[0], point[1], point[1], point[2], point[2]];

  let minDist = Infinity;
  let bestNormal = [0, 1, 0];
  for (let i = 0; i < 6; i++) {
    const dist = Math.abs(coords[i] - faces[i]);
    if (dist < minDist) {
      minDist = dist;
      bestNormal = normals[i];
    }
  }
  return bestNormal;
}

/**
 * AABB同士のオーバーラップ深度と法線を返す（分離軸定理・軸整列版）
 * @returns {{ normal: number[], depth: number } | null}
 */
function aabbOverlap(minA, maxA, minB, maxB) {
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  let minDepth = Infinity;
  let bestAxis = null;

  for (let i = 0; i < 3; i++) {
    const overlapMin = Math.max(minA[i], minB[i]);
    const overlapMax = Math.min(maxA[i], maxB[i]);
    const depth = overlapMax - overlapMin;
    if (depth <= 0) return null; // 分離している
    if (depth < minDepth) {
      minDepth = depth;
      // めり込みが最小の軸方向に押し出す（AからBへ向かう方向）
      const centerA = (minA[i] + maxA[i]) * 0.5;
      const centerB = (minB[i] + maxB[i]) * 0.5;
      const dir = centerB - centerA >= 0 ? -1 : 1; // AをBから遠ざける
      bestAxis = axes[i].map((v, j) => (j === i ? dir * v : v));
    }
  }
  return { normal: bestAxis, depth: minDepth };
}

// Möller–Trumbore アルゴリズム（レイ vs 三角形）
function rayTriangle(origin, dir, v0, v1, v2) {
  const EPSILON = 1e-8;
  const edge1 = vec3.sub(v1, v0);
  const edge2 = vec3.sub(v2, v0);
  const h = vec3.cross(dir, edge2);
  const a = vec3.dot(edge1, h);
  if (Math.abs(a) < EPSILON) return null;
  const f = 1 / a;
  const s = vec3.sub(origin, v0);
  const u = f * vec3.dot(s, h);
  if (u < 0 || u > 1) return null;
  const q = vec3.cross(s, edge1);
  const v = f * vec3.dot(dir, q);
  if (v < 0 || u + v > 1) return null;
  const t = f * vec3.dot(edge2, q);
  if (t < EPSILON) return null;
  return t;
}

// ── PhysicsSystem ──────────────────────────────────────────

export class PhysicsSystem {
  constructor(/** @type {Engine} */ engine) {
    this.engine = engine;
    // 反発係数（0=完全非弾性, 1=完全弾性）
    this.restitution = 0.3;
    // 静止摩擦・動摩擦係数
    this.staticFriction = 1;
    this.dynamicFriction = 1;
  }

  // ── Raycast ───────────────────────────────────────────────

  raycastBoxCollider(position, direction, skipCollider) {
    /** @type {BoxCollider[]} */
    const boxColliders = this.engine.scene.getComponents(BoxCollider);
    let closestHit = null;
    let closestT = Infinity;
    const dir = vec3.normalize(direction);

    for (const bc of boxColliders) {
      if (bc == skipCollider) continue;
      const transform = bc.gameObject.getComponent(Transform);
      if (!transform) continue;
      const worldMatrix = transform.getWorldMatrix();
      const invWorld = mat4.invert(worldMatrix);
      if (!invWorld) continue;

      const localOrigin = vec3.transformMat4(position, invWorld);
      const localDir = vec3.transformMat4Direction(dir, invWorld);

      // 変更後
      const center = bc.center ?? [0, 0, 0];
      const half = vec3.scale(bc.size, 0.5);
      const aabbMin = vec3.sub(center, half);
      const aabbMax = vec3.add(center, half);

      // Slab法
      let tMin = -Infinity,
        tMax = Infinity;
      const originArr = [localOrigin[0], localOrigin[1], localOrigin[2]];
      const dirArr = [localDir[0], localDir[1], localDir[2]];
      const minArr = [aabbMin[0], aabbMin[1], aabbMin[2]];
      const maxArr = [aabbMax[0], aabbMax[1], aabbMax[2]];
      let missed = false;

      for (let i = 0; i < 3; i++) {
        const d = dirArr[i],
          o = originArr[i];
        if (Math.abs(d) < 1e-8) {
          if (o < minArr[i] || o > maxArr[i]) {
            missed = true;
            break;
          }
        } else {
          let t1 = (minArr[i] - o) / d;
          let t2 = (maxArr[i] - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tMin = Math.max(tMin, t1);
          tMax = Math.min(tMax, t2);
          if (tMin > tMax) {
            missed = true;
            break;
          }
        }
      }
      if (missed || tMax < 0) continue;
      const t = tMin >= 0 ? tMin : tMax;
      if (t < closestT) {
        closestT = t;
        const localHit = vec3.add(localOrigin, vec3.scale(localDir, t));
        const hitPoint = vec3.transformMat4(localHit, worldMatrix);
        const localNormal = computeAABBNormal(localHit, aabbMin, aabbMax);
        const normalMatrix = mat4.transpose(invWorld);
        const worldNormal = vec3.normalize(
          vec3.transformMat4Direction(localNormal, normalMatrix),
        );
        closestHit = {
          collider: bc,
          gameObject: bc.gameObject,
          point: hitPoint,
          normal: worldNormal,
          distance: t,
        };
      }
    }
    return closestHit;
  }

  raycastMeshCollider(position, direction, skipCollider) {
    /** @type {MeshCollider[]} */
    const colliders = this.engine.scene.getComponents(MeshCollider);
    let closestHit = null;
    let closestT = Infinity;
    const dir = vec3.normalize(direction);

    for (const collider of colliders) {
      if (collider == skipCollider) continue;
      const transform = collider.gameObject.getComponent(Transform);
      if (!transform) continue;
      const worldMatrix = transform.getWorldMatrix();
      const invWorld = mat4.invert(worldMatrix);
      if (!invWorld) continue;

      const localOrigin = vec3.transformMat4(position, invWorld);
      const localDir = vec3.transformMat4Direction(dir, invWorld);

      // バウンディングボックスで早期棄却
      const bbMin = collider.boundingbox.min;
      const bbMax = collider.boundingbox.max;
      if (!this._rayAABB(localOrigin, localDir, bbMin, bbMax)) continue;

      // チャンクを絞り込んでから三角形テスト
      const chunksToTest = this._getChunksAlongRay(
        collider,
        localOrigin,
        localDir,
      );
      const tested = new Set();

      for (const chunkId of chunksToTest) {
        const tris = collider.getChunkMesh(chunkId);
        if (!tris) continue;
        for (const tri of tris) {
          // 同一三角形の重複テストを防止
          const key = tri.toString();
          if (tested.has(key)) continue;
          tested.add(key);

          const t = rayTriangle(localOrigin, localDir, tri[0], tri[1], tri[2]);
          if (t === null || t >= closestT) continue;

          // ワールド空間での交差点
          const localHit = vec3.add(localOrigin, vec3.scale(localDir, t));
          const worldHit = vec3.transformMat4(localHit, worldMatrix);
          // ワールド距離に換算
          const worldDist = vec3.length(vec3.sub(worldHit, position));

          if (worldDist < closestT) {
            closestT = worldDist;
            // 法線（面法線）
            const edge1 = vec3.sub(tri[1], tri[0]);
            const edge2 = vec3.sub(tri[2], tri[0]);
            const localNormal = vec3.normalize(vec3.cross(edge1, edge2));
            const normalMatrix = mat4.transpose(invWorld);
            const worldNormal = vec3.normalize(
              vec3.transformMat4Direction(localNormal, normalMatrix),
            );
            closestHit = {
              collider,
              gameObject: collider.gameObject,
              point: worldHit,
              normal: worldNormal,
              distance: worldDist,
            };
          }
        }
      }
    }
    return closestHit;
  }

  raycast(position, direction, skipCollider = null) {
    const r1 = this.raycastBoxCollider(position, direction, skipCollider);
    const r2 = this.raycastMeshCollider(position, direction, skipCollider);
    if (!r1) return r2;
    if (!r2) return r1;
    return r1.distance <= r2.distance ? r1 : r2;
  }

  // ── メインループ ───────────────────────────────────────────

  update() {
    /** @type {Rigidbody[]} */
    const rigidbodies = this.engine.scene.getComponents(Rigidbody);

    // rbの更新
    for (const rb of rigidbodies) {
      if (rb.isKinematic) continue;

      // 重力
      rb.applyGravity();

      rb.updatePosition();
      rb.updateRotation();
    }

    // ③ 衝突検出 & 解消
    this._resolveCollisions(rigidbodies);
  }

  // ── 衝突解消 ─────────────────────────────────────────────
  _resolveCollisions(rigidbodies) {
    /** @type {BoxCollider[]} */
    const boxColliders = this.engine.scene.getComponents(BoxCollider);
    /** @type {MeshCollider[]} */
    const meshColliders = this.engine.scene.getComponents(MeshCollider);

    // Colliderを持つRigidbodyのペアをチェック
    for (let i = 0; i < rigidbodies.length; i++) {
      const rbA = rigidbodies[i];
      if (rbA.isKinematic) continue;
      const transformA = rbA.gameObject.getComponent(Transform);
      const colliderA = rbA.gameObject.getComponent(BoxCollider);
      if (!transformA || !colliderA) continue;

      // AABBをワールド空間で取得
      const { min: minA, max: maxA } = this._getWorldAABB(
        transformA,
        colliderA,
      );

      // ── 対Rigidbody衝突 ──
      for (let j = i + 1; j < rigidbodies.length; j++) {
        const rbB = rigidbodies[j];
        const transformB = rbB.gameObject.getComponent(Transform);
        const colliderB = rbB.gameObject.getComponent(BoxCollider);
        if (!transformB || !colliderB) continue;

        const { min: minB, max: maxB } = this._getWorldAABB(
          transformB,
          colliderB,
        );
        const overlap = aabbOverlap(minA, maxA, minB, maxB);
        if (!overlap) continue;

        this._applyCollisionResponse(
          rbA,
          transformA,
          rbB,
          transformB,
          overlap.normal,
          overlap.depth,
        );
      }

      // ── 対静的Collider衝突（Rigidbodyなし） ──
      for (const bc of boxColliders) {
        if (bc.gameObject === rbA.gameObject) continue;
        if (bc.gameObject.getComponent(Rigidbody)) continue; // 動的はペアで処理済み

        const transformB = bc.gameObject.getComponent(Transform);
        if (!transformB) continue;

        const { min: minB, max: maxB } = this._getWorldAABB(transformB, bc);
        const overlap = aabbOverlap(minA, maxA, minB, maxB);
        if (!overlap) continue;

        this._applyStaticCollisionResponse(
          rbA,
          transformA,
          overlap.normal,
          overlap.depth,
        );
      }

      // ── 対MeshCollider衝突 ──
      for (const mc of meshColliders) {
        if (mc.gameObject === rbA.gameObject) continue;
        const transformB = mc.gameObject.getComponent(Transform);
        if (!transformB) continue;

        // 変更後（transformAごと渡す）
        const hit = this._spherecastMeshCollider(
          transformA,
          colliderA,
          mc,
          transformB,
        );
        if (!hit) continue;

        this._applyStaticCollisionResponse(
          rbA,
          transformA,
          hit.normal,
          hit.depth,
        );
      }
    }
  }

  /**
   * AABB vs MeshCollider の簡易衝突判定
   * AABBの中心点から最近接点を求め、貫通量を返す
   */
  _spherecastMeshCollider(transformA, colliderA, meshCollider, transformB) {
    const wmA = transformA.getWorldMatrix();
    const wmB = transformB.getWorldMatrix();
    const invWorldB = mat4.invert(wmB);
    if (!invWorldB) return null;

    // centerをワールド空間→MeshBのローカル空間へ正確に変換
    const worldCenter = vec3.transformMat4(colliderA.center ?? [0, 0, 0], wmA);
    const localCenter = vec3.transformMat4(worldCenter, invWorldB);

    // 周囲3×3チャンクを検索
    const cs = meshCollider.chunkSize;
    const bbMin = meshCollider.boundingbox.min;
    const cx = Math.floor((localCenter[0] - bbMin[0]) / cs);
    const cz = Math.floor((localCenter[2] - bbMin[2]) / cs);

    const chunkIds = new Set();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = cx + dx,
          nz = cz + dz;
        if (
          nx >= 0 &&
          nx < meshCollider.chunkW &&
          nz >= 0 &&
          nz < meshCollider.chunkH
        ) {
          chunkIds.add(nx + nz * meshCollider.chunkW);
        }
      }
    }

    const halfA = vec3.scale(colliderA.size ?? [1, 1, 1], 0.5);
    const sxA = Math.hypot(wmA[0], wmA[1], wmA[2]);
    const syA = Math.hypot(wmA[4], wmA[5], wmA[6]);
    const szA = Math.hypot(wmA[8], wmA[9], wmA[10]);

    const sxB = Math.hypot(wmB[0], wmB[1], wmB[2]);
    const syB = Math.hypot(wmB[4], wmB[5], wmB[6]);
    const szB = Math.hypot(wmB[8], wmB[9], wmB[10]);

    // AのワールドサイズをBのローカルスケールで割る
    const radius = Math.max(
      // maxだと横にデカくなりすぎるけどしょうがない
      (halfA[0] * sxA) / sxB,
      (halfA[1] * syA) / syB,
      (halfA[2] * szA) / szB,
    );

    let bestDepth = 0;
    let bestNormal = null;

    for (const chunkId of chunkIds) {
      const tris = meshCollider.getChunkMesh(chunkId);
      if (!tris || tris.length === 0) continue;
      for (const tri of tris) {
        const closest = this._closestPointOnTriangle(
          localCenter,
          tri[0],
          tri[1],
          tri[2],
        );
        const diff = vec3.sub(localCenter, closest);
        const dist = vec3.length(diff);
        const depth = radius - dist;
        if (depth > bestDepth) {
          bestDepth = depth;
          bestNormal = dist > 1e-8 ? vec3.normalize(diff) : [0, 1, 0];
        }
      }
    }
    if (!bestNormal) return null;

    const normalMatrix = mat4.transpose(invWorldB);
    const worldNormal = vec3.normalize(
      vec3.transformMat4Direction(bestNormal, normalMatrix),
    );
    return { normal: worldNormal, depth: bestDepth };
  }

  /** 三角形上の最近接点 */
  _closestPointOnTriangle(p, a, b, c) {
    const ab = vec3.sub(b, a),
      ac = vec3.sub(c, a),
      ap = vec3.sub(p, a);
    const d1 = vec3.dot(ab, ap),
      d2 = vec3.dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return a;
    const bp = vec3.sub(p, b);
    const d3 = vec3.dot(ab, bp),
      d4 = vec3.dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return b;
    const cp = vec3.sub(p, c);
    const d5 = vec3.dot(ab, cp),
      d6 = vec3.dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return c;
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      return vec3.add(a, vec3.scale(ab, v));
    }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      return vec3.add(a, vec3.scale(ac, w));
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      return vec3.add(b, vec3.scale(vec3.sub(c, b), w));
    }
    const denom = 1 / (va + vb + vc);
    const v = vb * denom,
      w = vc * denom;
    return vec3.add(a, vec3.add(vec3.scale(ab, v), vec3.scale(ac, w)));
  }

  /**
   * 動的 vs 動的 衝突応答（Unityの衝突応答式）
   * 衝撃量 J = -(1+e)*vRel·n / (1/mA + 1/mB)
   */
  _applyCollisionResponse(rbA, transformA, rbB, transformB, normal, depth) {
    const massA = Math.max(rbA.mass, 0.0001);
    const massB = Math.max(rbB.mass, 0.0001);
    const invMassA = rbA.isKinematic ? 0 : 1 / massA;
    const invMassB = rbB.isKinematic ? 0 : 1 / massB;
    const totalInvMass = invMassA + invMassB;
    if (totalInvMass === 0) return;

    // ① 位置補正（Baumgarte法・スリップ込み）
    const slop = 0.01; // 許容貫通量
    const percent = 0.4; // 補正割合
    const correctionMag = (Math.max(depth - slop, 0) / totalInvMass) * percent;
    const correction = vec3.scale(normal, correctionMag);
    if (!rbA.isKinematic)
      transformA.setPosition(
        vec3.sub(transformA.position, vec3.scale(correction, invMassA)),
      );
    if (!rbB.isKinematic)
      transformB.setPosition(
        vec3.add(transformB.position, vec3.scale(correction, invMassB)),
      );

    // ② 速度衝突応答
    const relVel = vec3.sub(rbA.velocity, rbB.velocity);
    const relVelN = vec3.dot(relVel, normal);
    if (relVelN > 0) return; // 既に離れている

    const e = this.restitution;
    const j = (-(1 + e) * relVelN) / totalInvMass;
    const impulse = vec3.scale(normal, j);

    if (!rbA.isKinematic)
      vec3.add(rbA.velocity, vec3.scale(impulse, invMassA), rbA.velocity);
    if (!rbB.isKinematic)
      vec3.sub(rbB.velocity, vec3.scale(impulse, invMassB), rbB.velocity);

    // ③ 摩擦（接線方向）
    this._applyFriction(rbA, rbB, normal, j, invMassA, invMassB);
  }

  /**
   * 動的 vs 静的 衝突応答
   */
  _applyStaticCollisionResponse(rb, transform, normal, depth) {
    if (rb.isKinematic) return;

    // 位置補正
    const slop = 0.01;
    const percent = 0.6;
    const correction = Math.max(depth - slop, 0) * percent;
    transform.setPosition(
      vec3.add(transform.position, vec3.scale(normal, correction)),
    );

    // 速度の法線成分を反射（反発係数付き）
    const velN = vec3.dot(rb.velocity, normal);
    if (velN >= 0) return; // 既に離れている方向

    const restitution = this.restitution;
    const impulse = vec3.scale(normal, -(1 + restitution) * velN);
    vec3.add(rb.velocity, impulse, rb.velocity);

    // 摩擦（接線成分を減衰）
    const velT = vec3.sub(
      rb.velocity,
      vec3.scale(normal, vec3.dot(rb.velocity, normal)),
    );
    const velTLen = vec3.length(velT);
    if (velTLen > 1e-6) {
      const frictionImpulseMag = Math.min(
        this.dynamicFriction * Math.abs(-(1 + restitution) * velN),
        velTLen,
      );
      const frictionDir = vec3.scale(velT, -1 / velTLen);
      vec3.add(
        rb.velocity,
        vec3.scale(frictionDir, frictionImpulseMag),
        rb.velocity,
      );
    }
  }

  /** 2体間の摩擦応答 */
  _applyFriction(rbA, rbB, normal, jMag, invMassA, invMassB) {
    const totalInvMass = invMassA + invMassB;
    const relVel = vec3.sub(rbA.velocity, rbB.velocity);
    const relVelN = vec3.dot(relVel, normal);
    const tangent_raw = vec3.sub(relVel, vec3.scale(normal, relVelN));
    const tLen = vec3.length(tangent_raw);
    if (tLen < 1e-8) return;
    const tangent = vec3.scale(tangent_raw, 1 / tLen);

    const jt = -vec3.dot(relVel, tangent) / totalInvMass;
    let frictionImpulse;
    // クーロン摩擦モデル
    if (Math.abs(jt) < jMag * this.staticFriction) {
      frictionImpulse = vec3.scale(tangent, jt);
    } else {
      frictionImpulse = vec3.scale(tangent, -jMag * this.dynamicFriction);
    }

    if (!rbA.isKinematic)
      vec3.add(
        rbA.velocity,
        vec3.scale(frictionImpulse, invMassA),
        rbA.velocity,
      );
    if (!rbB.isKinematic)
      vec3.sub(
        rbB.velocity,
        vec3.scale(frictionImpulse, invMassB),
        rbB.velocity,
      );
  }

  // ── ヘルパー ─────────────────────────────────────────────

  /** ワールド空間AABB取得 */
  _getWorldAABB(transform, collider) {
    const wm = transform.getWorldMatrix();

    // centerをワールド空間へ変換（positionではなくwmで変換）
    const worldCenter = vec3.transformMat4(collider.center ?? [0, 0, 0], wm);

    const sx = Math.hypot(wm[0], wm[1], wm[2]);
    const sy = Math.hypot(wm[4], wm[5], wm[6]);
    const sz = Math.hypot(wm[8], wm[9], wm[10]);
    const wHalf = [
      collider.size[0] * 0.5 * sx,
      collider.size[1] * 0.5 * sy,
      collider.size[2] * 0.5 * sz,
    ];
    return {
      min: [
        worldCenter[0] - wHalf[0],
        worldCenter[1] - wHalf[1],
        worldCenter[2] - wHalf[2],
      ],
      max: [
        worldCenter[0] + wHalf[0],
        worldCenter[1] + wHalf[1],
        worldCenter[2] + wHalf[2],
      ],
    };
  }

  /** レイがAABBに当たるか（ローカル空間） */
  _rayAABB(origin, dir, bbMin, bbMax) {
    let tMin = -Infinity,
      tMax = Infinity;
    for (let i = 0; i < 3; i++) {
      const d = [dir[0], dir[1], dir[2]][i];
      const o = [origin[0], origin[1], origin[2]][i];
      if (Math.abs(d) < 1e-8) {
        if (o < bbMin[i] || o > bbMax[i]) return false;
      } else {
        let t1 = (bbMin[i] - o) / d,
          t2 = (bbMax[i] - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
      }
    }
    return tMax >= 0;
  }

  /** レイの通過チャンクIDリストを返す（DDA法） */
  _getChunksAlongRay(meshCollider, origin, dir) {
    const cs = meshCollider.chunkSize;
    const bbMin = meshCollider.boundingbox.min;
    const result = [];
    // X-Z平面でDDA
    let x = Math.floor((origin[0] - bbMin[0]) / cs);
    let z = Math.floor((origin[2] - bbMin[2]) / cs);
    const stepX = dir[0] > 0 ? 1 : -1;
    const stepZ = dir[2] > 0 ? 1 : -1;
    const tDeltaX = Math.abs(cs / (dir[0] || 1e-8));
    const tDeltaZ = Math.abs(cs / (dir[2] || 1e-8));
    let tMaxX =
      ((stepX > 0
        ? (Math.floor(origin[0] / cs) + 1) * cs
        : Math.floor(origin[0] / cs) * cs) -
        origin[0]) /
      (dir[0] || 1e-8);
    let tMaxZ =
      ((stepZ > 0
        ? (Math.floor(origin[2] / cs) + 1) * cs
        : Math.floor(origin[2] / cs) * cs) -
        origin[2]) /
      (dir[2] || 1e-8);

    for (let step = 0; step < 64; step++) {
      if (
        x >= 0 &&
        x < meshCollider.chunkW &&
        z >= 0 &&
        z < meshCollider.chunkH
      ) {
        result.push(x + z * meshCollider.chunkW);
      }
      if (tMaxX < tMaxZ) {
        tMaxX += tDeltaX;
        x += stepX;
      } else {
        tMaxZ += tDeltaZ;
        z += stepZ;
      }
    }
    return result;
  }
}
