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
    // Wave hand (right hand)
    name: "wave",
    duration: 2.0,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.2,
        pose: {
          rightUpperArm: quatMul(quatZ(-20), quatX(-30)),
          rightLowerArm: quatMul(quatZ(-70), quatX(-20)),
          rightHand: quatZ(10),
        },
      },
      {
        time: 0.4,
        pose: {
          rightUpperArm: quatMul(quatZ(-20), quatX(-30)),
          rightLowerArm: quatMul(quatZ(-70), quatX(-20)),
          rightHand: quatZ(-20),
          head: quatMul(quatZ(5), quatX(3)),
        },
      },
      {
        time: 0.6,
        pose: {
          rightUpperArm: quatMul(quatZ(-20), quatX(-30)),
          rightLowerArm: quatMul(quatZ(-70), quatX(-20)),
          rightHand: quatZ(15),
          head: quatMul(quatZ(-3), quatX(2)),
        },
      },
      {
        time: 0.8,
        pose: {
          rightUpperArm: quatMul(quatZ(-20), quatX(-30)),
          rightLowerArm: quatMul(quatZ(-70), quatX(-20)),
          rightHand: quatZ(-15),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Big nod
    name: "nod",
    duration: 1.4,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.2,
        pose: { head: quatX(15), neck: quatX(5) },
      },
      {
        time: 0.35,
        pose: { head: quatX(-3), neck: quatX(-2) },
      },
      {
        time: 0.5,
        pose: { head: quatX(12), neck: quatX(4) },
      },
      {
        time: 0.7,
        pose: { head: quatX(-2), neck: quatX(-1) },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Tilt head cutely
    name: "headTilt",
    duration: 2.0,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.3,
        pose: {
          head: quatMul(quatZ(12), quatX(5)),
          neck: quatZ(5),
          spine: quatZ(2),
        },
      },
      {
        time: 0.7,
        pose: {
          head: quatMul(quatZ(10), quatX(3)),
          neck: quatZ(4),
          spine: quatZ(1),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Touch chin (thinking)
    name: "thinking",
    duration: 3.0,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.2,
        pose: {
          rightUpperArm: quatMul(quatZ(-40), quatX(-40)),
          rightLowerArm: quatMul(quatZ(-90), quatX(-30)),
          rightHand: quatX(-20),
          head: quatMul(quatZ(5), quatX(8)),
          neck: quatZ(3),
        },
      },
      {
        time: 0.5,
        pose: {
          rightUpperArm: quatMul(quatZ(-40), quatX(-40)),
          rightLowerArm: quatMul(quatZ(-90), quatX(-30)),
          rightHand: quatX(-20),
          head: quatMul(quatZ(3), quatX(10)),
          neck: quatZ(2),
        },
      },
      {
        time: 0.8,
        pose: {
          rightUpperArm: quatMul(quatZ(-40), quatX(-40)),
          rightLowerArm: quatMul(quatZ(-90), quatX(-30)),
          rightHand: quatX(-15),
          head: quatMul(quatZ(6), quatX(6)),
          neck: quatZ(4),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Both hands clasp (excited)
    name: "excited",
    duration: 1.8,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.15,
        pose: {
          leftUpperArm: quatMul(quatZ(30), quatX(-35)),
          rightUpperArm: quatMul(quatZ(-30), quatX(-35)),
          leftLowerArm: quatMul(quatZ(80), quatX(-10)),
          rightLowerArm: quatMul(quatZ(-80), quatX(-10)),
          spine: quatX(5),
        },
      },
      {
        time: 0.35,
        pose: {
          leftUpperArm: quatMul(quatZ(30), quatX(-30)),
          rightUpperArm: quatMul(quatZ(-30), quatX(-30)),
          leftLowerArm: quatMul(quatZ(80), quatX(-10)),
          rightLowerArm: quatMul(quatZ(-80), quatX(-10)),
          spine: quatX(-2),
          hips: quatX(-2),
        },
      },
      {
        time: 0.55,
        pose: {
          leftUpperArm: quatMul(quatZ(30), quatX(-35)),
          rightUpperArm: quatMul(quatZ(-30), quatX(-35)),
          leftLowerArm: quatMul(quatZ(80), quatX(-10)),
          rightLowerArm: quatMul(quatZ(-80), quatX(-10)),
          spine: quatX(5),
        },
      },
      {
        time: 0.75,
        pose: {
          leftUpperArm: quatMul(quatZ(30), quatX(-30)),
          rightUpperArm: quatMul(quatZ(-30), quatX(-30)),
          leftLowerArm: quatMul(quatZ(80), quatX(-10)),
          rightLowerArm: quatMul(quatZ(-80), quatX(-10)),
          spine: quatX(-2),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Stretch arms up
    name: "stretch",
    duration: 3.5,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.25,
        pose: {
          leftUpperArm: quatMul(quatZ(10), quatX(-120)),
          rightUpperArm: quatMul(quatZ(-10), quatX(-120)),
          leftLowerArm: quatZ(20),
          rightLowerArm: quatZ(-20),
          spine: quatX(-8),
          head: quatX(-10),
        },
      },
      {
        time: 0.5,
        pose: {
          leftUpperArm: quatMul(quatZ(5), quatX(-140)),
          rightUpperArm: quatMul(quatZ(-5), quatX(-140)),
          leftLowerArm: quatZ(15),
          rightLowerArm: quatZ(-15),
          spine: quatX(-10),
          head: quatX(-12),
        },
      },
      {
        time: 0.75,
        pose: {
          leftUpperArm: quatMul(quatZ(10), quatX(-120)),
          rightUpperArm: quatMul(quatZ(-10), quatX(-120)),
          leftLowerArm: quatZ(20),
          rightLowerArm: quatZ(-20),
          spine: quatX(-5),
          head: quatX(-5),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  {
    // Shy pose - hands together in front
    name: "shy",
    duration: 2.5,
    keyframes: [
      { time: 0.0, pose: {} },
      {
        time: 0.2,
        pose: {
          leftUpperArm: quatMul(quatZ(45), quatX(-25)),
          rightUpperArm: quatMul(quatZ(-45), quatX(-25)),
          leftLowerArm: quatMul(quatZ(60), quatX(-20)),
          rightLowerArm: quatMul(quatZ(-60), quatX(-20)),
          head: quatMul(quatX(10), quatZ(8)),
          spine: quatX(5),
          hips: quatZ(3),
        },
      },
      {
        time: 0.5,
        pose: {
          leftUpperArm: quatMul(quatZ(45), quatX(-25)),
          rightUpperArm: quatMul(quatZ(-45), quatX(-25)),
          leftLowerArm: quatMul(quatZ(60), quatX(-20)),
          rightLowerArm: quatMul(quatZ(-60), quatX(-20)),
          head: quatMul(quatX(8), quatZ(-5)),
          spine: quatX(4),
          hips: quatZ(-2),
        },
      },
      {
        time: 0.8,
        pose: {
          leftUpperArm: quatMul(quatZ(45), quatX(-25)),
          rightUpperArm: quatMul(quatZ(-45), quatX(-25)),
          leftLowerArm: quatMul(quatZ(60), quatX(-20)),
          rightLowerArm: quatMul(quatZ(-60), quatX(-20)),
          head: quatMul(quatX(10), quatZ(5)),
          spine: quatX(5),
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
];

// Emotion-specific gesture probabilities
const EMOTION_GESTURES: Record<string, string[]> = {
  happy: ["wave", "excited", "nod"],
  surprised: ["excited", "stretch"],
  shy: ["shy", "headTilt"],
  sad: ["thinking", "headTilt"],
  angry: ["headTilt", "thinking"],
  neutral: ["wave", "nod", "headTilt", "thinking", "stretch"],
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
  private gestureTimer = 5 + Math.random() * 8; // time until next gesture
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

    // Arms: ~65 degrees down from T-pose with gentle wobble
    const baseArmAngle = 65;
    const armWobble = Math.sin(t * 0.6 + this.armPhase) * 2;
    const armForward = Math.sin(t * 0.35) * 3;

    const leftUpperArm = quatMul(
      quatZ(baseArmAngle + armWobble),
      quatX(armForward)
    );
    const rightUpperArm = quatMul(
      quatZ(-(baseArmAngle + armWobble)),
      quatX(armForward)
    );

    // Lower arms: bend with gentle movement
    const lowerArmBend = 15 + Math.sin(t * 0.4) * 3;
    const leftLowerArm = quatZ(lowerArmBend);
    const rightLowerArm = quatZ(-lowerArmBend);

    // Breathing (spine)
    const breathAngle = 2 + Math.sin(t * 1.8) * 1.2;
    const spine = quatX(breathAngle);

    // Body sway (hips) - more pronounced
    const swayAngle = Math.sin(t * 0.5 + this.swayPhase) * 1.5;
    const hipForward = Math.sin(t * 0.3) * 0.6;
    const hips = quatMul(quatZ(swayAngle), quatX(hipForward));

    // Head movement - more lively
    const headYaw = Math.sin(t * 0.4 + this.headPhase) * 6;
    const headTilt = Math.sin(t * 0.3 + this.headPhase + 1) * 4;
    const headNod = Math.sin(t * 0.5) * 3;
    const head = quatMul(quatMul(quatY(headYaw), quatZ(headTilt)), quatX(headNod));

    // Neck
    const neckYaw = Math.sin(t * 0.4 + this.headPhase) * 2.5;
    const neck = quatY(neckYaw);

    // Hands
    const leftHand = quatZ(Math.sin(t * 0.7) * 5);
    const rightHand = quatZ(Math.sin(t * 0.7 + 1) * -5);

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

      // Blend in/out
      const blendInTime = 0.15;
      const blendOutTime = 0.15;
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
        this.gestureTimer = 4 + Math.random() * 10;
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
