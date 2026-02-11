import type { VRM } from "@pixiv/three-vrm";

const DEG = Math.PI / 180;
type Q4 = [number, number, number, number];
const IDENTITY: Q4 = [0, 0, 0, 1];

function quatZ(angleDeg: number): Q4 {
  const rad = angleDeg * DEG * 0.5;
  return [0, 0, Math.sin(rad), Math.cos(rad)];
}

function quatX(angleDeg: number): Q4 {
  const rad = angleDeg * DEG * 0.5;
  return [Math.sin(rad), 0, 0, Math.cos(rad)];
}

function quatY(angleDeg: number): Q4 {
  const rad = angleDeg * DEG * 0.5;
  return [0, Math.sin(rad), 0, Math.cos(rad)];
}

function quatMul(a: Q4, b: Q4): Q4 {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** Spherical linear interpolation between two quaternions */
function slerp(a: Q4, b: Q4, t: number): Q4 {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const neg = dot < 0;
  if (neg) {
    dot = -dot;
    b = [-b[0], -b[1], -b[2], -b[3]];
  }
  if (dot > 0.9995) {
    const r: Q4 = [
      a[0] + t * (b[0] - a[0]),
      a[1] + t * (b[1] - a[1]),
      a[2] + t * (b[2] - a[2]),
      a[3] + t * (b[3] - a[3]),
    ];
    const len = Math.sqrt(r[0] ** 2 + r[1] ** 2 + r[2] ** 2 + r[3] ** 2);
    return [r[0] / len, r[1] / len, r[2] / len, r[3] / len];
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return [
    wa * a[0] + wb * b[0],
    wa * a[1] + wb * b[1],
    wa * a[2] + wb * b[2],
    wa * a[3] + wb * b[3],
  ];
}

// ========== Gesture definitions ==========

interface GesturePose {
  leftUpperArm?: Q4;
  rightUpperArm?: Q4;
  leftLowerArm?: Q4;
  rightLowerArm?: Q4;
  leftHand?: Q4;
  rightHand?: Q4;
  head?: Q4;
  neck?: Q4;
  spine?: Q4;
  hips?: Q4;
}

interface GestureKeyframe {
  time: number; // 0.0 - 1.0
  pose: GesturePose;
}

interface GestureDefinition {
  name: string;
  duration: number; // seconds
  keyframes: GestureKeyframe[];
}

const GESTURES: GestureDefinition[] = [
  {
    // Small nod
    name: "nod",
    duration: 1.8,
    keyframes: [
      { time: 0.0, pose: {} },
      { time: 0.25, pose: { head: quatX(8), neck: quatX(3) } },
      { time: 0.45, pose: { head: quatX(-1), neck: quatX(0) } },
      { time: 0.6, pose: { head: quatX(6), neck: quatX(2) } },
      { time: 0.8, pose: { head: quatX(0), neck: quatX(0) } },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Gentle head tilt
    name: "headTilt",
    duration: 2.5,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.35,
        pose: {
          head: quatMul(quatZ(6), quatX(2)),
          neck: quatZ(2),
        },
      },
      {
        time: 0.65,
        pose: {
          head: quatMul(quatZ(5), quatX(1)),
          neck: quatZ(2),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Touch face lightly (thinking)
    name: "thinking",
    duration: 3.5,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.25,
        pose: {
          rightUpperArm: quatMul(quatZ(-45), quatX(-20)),
          rightLowerArm: quatMul(quatZ(-50), quatX(-15)),
          head: quatMul(quatZ(3), quatX(4)),
          neck: quatZ(2),
        },
      },
      {
        time: 0.55,
        pose: {
          rightUpperArm: quatMul(quatZ(-45), quatX(-20)),
          rightLowerArm: quatMul(quatZ(-50), quatX(-15)),
          head: quatMul(quatZ(2), quatX(5)),
          neck: quatZ(1),
        },
      },
      {
        time: 0.8,
        pose: {
          rightUpperArm: quatMul(quatZ(-45), quatX(-20)),
          rightLowerArm: quatMul(quatZ(-50), quatX(-15)),
          head: quatMul(quatZ(3), quatX(3)),
          neck: quatZ(2),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Hands together (happy/excited) - gentle
    name: "excited",
    duration: 2.2,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.2,
        pose: {
          leftUpperArm: quatMul(quatZ(40), quatX(-15)),
          rightUpperArm: quatMul(quatZ(-40), quatX(-15)),
          leftLowerArm: quatMul(quatZ(45), quatX(-5)),
          rightLowerArm: quatMul(quatZ(-45), quatX(-5)),
          spine: quatX(2),
        },
      },
      {
        time: 0.45,
        pose: {
          leftUpperArm: quatMul(quatZ(40), quatX(-12)),
          rightUpperArm: quatMul(quatZ(-40), quatX(-12)),
          leftLowerArm: quatMul(quatZ(45), quatX(-5)),
          rightLowerArm: quatMul(quatZ(-45), quatX(-5)),
          spine: quatX(0),
        },
      },
      {
        time: 0.65,
        pose: {
          leftUpperArm: quatMul(quatZ(40), quatX(-15)),
          rightUpperArm: quatMul(quatZ(-40), quatX(-15)),
          leftLowerArm: quatMul(quatZ(45), quatX(-5)),
          rightLowerArm: quatMul(quatZ(-45), quatX(-5)),
          spine: quatX(2),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Shy - slight hands in front, look away
    name: "shy",
    duration: 3.0,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.25,
        pose: {
          leftUpperArm: quatMul(quatZ(50), quatX(-12)),
          rightUpperArm: quatMul(quatZ(-50), quatX(-12)),
          leftLowerArm: quatMul(quatZ(35), quatX(-10)),
          rightLowerArm: quatMul(quatZ(-35), quatX(-10)),
          head: quatMul(quatX(5), quatZ(4)),
          spine: quatX(2),
        },
      },
      {
        time: 0.55,
        pose: {
          leftUpperArm: quatMul(quatZ(50), quatX(-12)),
          rightUpperArm: quatMul(quatZ(-50), quatX(-12)),
          leftLowerArm: quatMul(quatZ(35), quatX(-10)),
          rightLowerArm: quatMul(quatZ(-35), quatX(-10)),
          head: quatMul(quatX(4), quatZ(-3)),
          spine: quatX(2),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
];

// Emotion-specific gesture choices
const EMOTION_GESTURES: Record<string, string[]> = {
  happy: ["excited", "nod"],
  surprised: ["excited", "nod"],
  shy: ["shy", "headTilt"],
  sad: ["thinking", "headTilt"],
  angry: ["headTilt", "thinking"],
  neutral: ["nod", "headTilt", "thinking"],
};

/**
 * Idle animation system for VRM avatars with random gestures and emotion reactions.
 */
export class IdleAnimator {
  private vrm: VRM;
  private elapsed = 0;

  // Random phase offsets
  private headPhase = Math.random() * Math.PI * 2;
  private swayPhase = Math.random() * Math.PI * 2;
  private armPhase = Math.random() * Math.PI * 2;

  // Blink state
  private blinkTimer = 2 + Math.random() * 4;
  private blinkProgress = -1;
  private readonly blinkDuration = 0.15;

  // Gesture state
  private currentGesture: GestureDefinition | null = null;
  private gestureTime = 0;
  private gestureTimer = 8 + Math.random() * 15; // time until next gesture
  private gestureBlend = 0; // 0 = idle only, 1 = gesture fully blended

  // Emotion for gesture selection
  private currentEmotion = "neutral";
  private emotionReactionPending = false;

  constructor(vrm: VRM) {
    this.vrm = vrm;
  }

  setEmotion(emotion: string) {
    if (emotion !== this.currentEmotion) {
      this.currentEmotion = emotion;
      this.emotionReactionPending = true;
    }
  }

  update(delta: number) {
    this.elapsed += delta;
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    // Handle emotion reaction - trigger a gesture immediately
    if (this.emotionReactionPending && !this.currentGesture) {
      this.emotionReactionPending = false;
      this.startGestureForEmotion();
    }

    // Update gesture timer
    this.updateGestureTimer(delta);

    // Calculate idle base pose
    const idlePose = this.calcIdlePose();

    // Calculate gesture pose and blend
    let finalPose = idlePose;
    if (this.currentGesture) {
      const gesturePose = this.calcGesturePose();
      finalPose = this.blendPoses(idlePose, gesturePose, this.gestureBlend);
    }

    humanoid.setNormalizedPose({
      hips: { rotation: finalPose.hips || IDENTITY },
      spine: { rotation: finalPose.spine || IDENTITY },
      neck: { rotation: finalPose.neck || IDENTITY },
      head: { rotation: finalPose.head || IDENTITY },
      leftShoulder: { rotation: finalPose.leftShoulder || quatZ(3) },
      rightShoulder: { rotation: finalPose.rightShoulder || quatZ(-3) },
      leftUpperArm: { rotation: finalPose.leftUpperArm || IDENTITY },
      rightUpperArm: { rotation: finalPose.rightUpperArm || IDENTITY },
      leftLowerArm: { rotation: finalPose.leftLowerArm || IDENTITY },
      rightLowerArm: { rotation: finalPose.rightLowerArm || IDENTITY },
      leftHand: { rotation: finalPose.leftHand || IDENTITY },
      rightHand: { rotation: finalPose.rightHand || IDENTITY },
    });

    this.updateBlink(delta);
  }

  private calcIdlePose(): Record<string, Q4> {
    const t = this.elapsed;

    // Arms: ~65 degrees down from T-pose with very subtle wobble
    const baseArmAngle = 65;
    const armWobble = Math.sin(t * 0.4 + this.armPhase) * 0.8;
    const armForward = Math.sin(t * 0.25) * 1;

    const leftUpperArm = quatMul(
      quatZ(baseArmAngle + armWobble),
      quatX(armForward)
    );
    const rightUpperArm = quatMul(
      quatZ(-(baseArmAngle + armWobble)),
      quatX(armForward)
    );

    // Lower arms: slight natural bend
    const lowerArmBend = 15 + Math.sin(t * 0.3) * 1;
    const leftLowerArm = quatZ(lowerArmBend);
    const rightLowerArm = quatZ(-lowerArmBend);

    // Breathing (spine) - subtle
    const breathAngle = 1 + Math.sin(t * 1.2) * 0.5;
    const spine = quatX(breathAngle);

    // Body sway (hips) - very gentle
    const swayAngle = Math.sin(t * 0.35 + this.swayPhase) * 0.5;
    const hipForward = Math.sin(t * 0.2) * 0.2;
    const hips = quatMul(quatZ(swayAngle), quatX(hipForward));

    // Head movement - natural, small
    const headYaw = Math.sin(t * 0.25 + this.headPhase) * 2.5;
    const headTilt = Math.sin(t * 0.2 + this.headPhase + 1) * 1.5;
    const headNod = Math.sin(t * 0.35) * 1;
    const head = quatMul(quatMul(quatY(headYaw), quatZ(headTilt)), quatX(headNod));

    // Neck - follows head gently
    const neckYaw = Math.sin(t * 0.25 + this.headPhase) * 1;
    const neck = quatY(neckYaw);

    // Hands - minimal
    const leftHand = quatZ(Math.sin(t * 0.5) * 2);
    const rightHand = quatZ(Math.sin(t * 0.5 + 1) * -2);

    return {
      hips,
      spine,
      neck,
      head,
      leftUpperArm,
      rightUpperArm,
      leftLowerArm,
      rightLowerArm,
      leftHand,
      rightHand,
    };
  }

  private updateGestureTimer(delta: number) {
    if (this.currentGesture) {
      this.gestureTime += delta;
      const progress = this.gestureTime / this.currentGesture.duration;

      // Blend in/out - slow transitions for natural feel
      const blendInTime = 0.25;
      const blendOutTime = 0.25;
      if (progress < blendInTime) {
        this.gestureBlend = progress / blendInTime;
      } else if (progress > 1 - blendOutTime) {
        this.gestureBlend = (1 - progress) / blendOutTime;
      } else {
        this.gestureBlend = 1;
      }
      this.gestureBlend = Math.max(0, Math.min(1, this.gestureBlend));

      if (progress >= 1) {
        this.currentGesture = null;
        this.gestureBlend = 0;
        this.gestureTimer = 8 + Math.random() * 15;
      }
    } else {
      this.gestureTimer -= delta;
      if (this.gestureTimer <= 0) {
        this.startGestureForEmotion();
      }
    }
  }

  private startGestureForEmotion() {
    const candidates = EMOTION_GESTURES[this.currentEmotion] || EMOTION_GESTURES.neutral;
    const gestureName = candidates[Math.floor(Math.random() * candidates.length)];
    const gesture = GESTURES.find((g) => g.name === gestureName);
    if (gesture) {
      this.currentGesture = gesture;
      this.gestureTime = 0;
      this.gestureBlend = 0;
    }
  }

  private calcGesturePose(): GesturePose {
    if (!this.currentGesture) return {};

    const progress = Math.min(this.gestureTime / this.currentGesture.duration, 1);
    const keyframes = this.currentGesture.keyframes;

    // Find surrounding keyframes
    let kfA = keyframes[0];
    let kfB = keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
        kfA = keyframes[i];
        kfB = keyframes[i + 1];
        break;
      }
    }

    const segmentDuration = kfB.time - kfA.time;
    const localT = segmentDuration > 0 ? (progress - kfA.time) / segmentDuration : 0;
    // Smooth ease in/out
    const smoothT = localT * localT * (3 - 2 * localT);

    return this.interpolatePoses(kfA.pose, kfB.pose, smoothT);
  }

  private interpolatePoses(a: GesturePose, b: GesturePose, t: number): GesturePose {
    const bones: (keyof GesturePose)[] = [
      "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm",
      "leftHand", "rightHand", "head", "neck", "spine", "hips",
    ];

    const result: GesturePose = {};
    for (const bone of bones) {
      const qa = a[bone] || null;
      const qb = b[bone] || null;
      if (qa && qb) {
        result[bone] = slerp(qa, qb, t);
      } else if (qa) {
        result[bone] = slerp(qa, IDENTITY, t);
      } else if (qb) {
        result[bone] = slerp(IDENTITY, qb, t);
      }
    }
    return result;
  }

  private blendPoses(idle: Record<string, Q4>, gesture: GesturePose, blend: number): Record<string, Q4> {
    const result = { ...idle };
    const bones: (keyof GesturePose)[] = [
      "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm",
      "leftHand", "rightHand", "head", "neck", "spine", "hips",
    ];

    for (const bone of bones) {
      const gestureQ = gesture[bone];
      if (gestureQ && result[bone]) {
        result[bone] = slerp(result[bone], gestureQ, blend);
      } else if (gestureQ) {
        result[bone] = slerp(IDENTITY, gestureQ, blend);
      }
    }
    return result;
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
