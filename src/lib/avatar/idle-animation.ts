import type { VRM } from "@pixiv/three-vrm";

const DEG = Math.PI / 180;

/** Create a quaternion from axis-angle (Z-axis rotation) */
function quatZ(angleDeg: number): [number, number, number, number] {
  const rad = angleDeg * DEG * 0.5;
  return [0, 0, Math.sin(rad), Math.cos(rad)];
}

/** Create a quaternion from axis-angle (X-axis rotation) */
function quatX(angleDeg: number): [number, number, number, number] {
  const rad = angleDeg * DEG * 0.5;
  return [Math.sin(rad), 0, 0, Math.cos(rad)];
}

/** Multiply two quaternions */
function quatMul(
  a: [number, number, number, number],
  b: [number, number, number, number]
): [number, number, number, number] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** Create quaternion from Y-axis rotation */
function quatY(angleDeg: number): [number, number, number, number] {
  const rad = angleDeg * DEG * 0.5;
  return [0, Math.sin(rad), 0, Math.cos(rad)];
}

/**
 * Idle animation system for VRM avatars.
 * Uses setNormalizedPose (quaternion-based) every frame for consistent results.
 */
export class IdleAnimator {
  private vrm: VRM;
  private elapsed = 0;

  // Random phase offsets for natural variation
  private headPhase = Math.random() * Math.PI * 2;
  private swayPhase = Math.random() * Math.PI * 2;
  private armPhase = Math.random() * Math.PI * 2;

  // Blink state
  private blinkTimer = 2 + Math.random() * 4;
  private blinkProgress = -1;
  private readonly blinkDuration = 0.15;

  constructor(vrm: VRM) {
    this.vrm = vrm;
  }

  update(delta: number) {
    this.elapsed += delta;
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const t = this.elapsed;

    // --- Base arm pose: ~65 degrees down from T-pose ---
    const baseArmAngle = 65;
    const armWobble = Math.sin(t * 0.6 + this.armPhase) * 1.5;
    const armForward = Math.sin(t * 0.35) * 2;

    const leftUpperArmQ = quatMul(
      quatZ(baseArmAngle + armWobble),
      quatX(armForward)
    );
    const rightUpperArmQ = quatMul(
      quatZ(-(baseArmAngle + armWobble)),
      quatX(armForward)
    );

    // Lower arms: slight bend
    const lowerArmBend = 15 + Math.sin(t * 0.4) * 2;
    const leftLowerArmQ = quatZ(lowerArmBend);
    const rightLowerArmQ = quatZ(-lowerArmBend);

    // --- Breathing (spine) ---
    const breathAngle = 2 + Math.sin(t * 1.8) * 0.8;
    const spineQ = quatX(breathAngle);

    // --- Body sway (hips) ---
    const swayAngle = Math.sin(t * 0.5 + this.swayPhase) * 0.8;
    const hipForward = Math.sin(t * 0.3) * 0.4;
    const hipsQ = quatMul(quatZ(swayAngle), quatX(hipForward));

    // --- Head movement ---
    const headYaw = Math.sin(t * 0.4 + this.headPhase) * 4;
    const headTilt = Math.sin(t * 0.3 + this.headPhase + 1) * 2;
    const headNod = Math.sin(t * 0.5) * 1.5;
    const headQ = quatMul(quatMul(quatY(headYaw), quatZ(headTilt)), quatX(headNod));

    // --- Neck ---
    const neckYaw = Math.sin(t * 0.4 + this.headPhase) * 1.5;
    const neckQ = quatY(neckYaw);

    // --- Hands ---
    const leftHandAngle = Math.sin(t * 0.7) * 3;
    const rightHandAngle = Math.sin(t * 0.7 + 1) * -3;

    // --- Shoulders ---
    const leftShoulderQ = quatZ(3);
    const rightShoulderQ = quatZ(-3);

    humanoid.setNormalizedPose({
      hips: { rotation: hipsQ },
      spine: { rotation: spineQ },
      neck: { rotation: neckQ },
      head: { rotation: headQ },
      leftShoulder: { rotation: leftShoulderQ },
      rightShoulder: { rotation: rightShoulderQ },
      leftUpperArm: { rotation: leftUpperArmQ },
      rightUpperArm: { rotation: rightUpperArmQ },
      leftLowerArm: { rotation: leftLowerArmQ },
      rightLowerArm: { rotation: rightLowerArmQ },
      leftHand: { rotation: quatZ(leftHandAngle) },
      rightHand: { rotation: quatZ(rightHandAngle) },
    });

    // --- Blinking ---
    this.updateBlink(delta);
  }

  private updateBlink(delta: number) {
    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) return;

    if (this.blinkProgress < 0) {
      this.blinkTimer -= delta;
      if (this.blinkTimer <= 0) {
        this.blinkProgress = 0;
        this.blinkTimer = 2 + Math.random() * 5;
      }
    } else {
      this.blinkProgress += delta;
      const p = this.blinkProgress / this.blinkDuration;

      if (p < 0.5) {
        expressionManager.setValue("blink", p * 2);
      } else if (p < 1.0) {
        expressionManager.setValue("blink", (1.0 - p) * 2);
      } else {
        expressionManager.setValue("blink", 0);
        this.blinkProgress = -1;
      }
    }
  }

  dispose() {
    this.vrm.humanoid?.resetNormalizedPose();
  }
}
