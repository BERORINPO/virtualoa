import type { VRM } from "@pixiv/three-vrm";
import type { Emotion } from "@/types";

interface ExpressionConfig {
  happy: number;
  angry: number;
  sad: number;
  surprised: number;
  relaxed: number;
  neutral: number;
}

const EMOTION_MAP: Record<Emotion, ExpressionConfig> = {
  happy: { happy: 1, angry: 0, sad: 0, surprised: 0, relaxed: 0.2, neutral: 0 },
  surprised: { happy: 0, angry: 0, sad: 0, surprised: 1, relaxed: 0, neutral: 0 },
  shy: { happy: 0.3, angry: 0, sad: 0, surprised: 0.2, relaxed: 0.7, neutral: 0 },
  sad: { happy: 0, angry: 0, sad: 1, surprised: 0, relaxed: 0, neutral: 0 },
  neutral: { happy: 0, angry: 0, sad: 0, surprised: 0, relaxed: 0.3, neutral: 0 },
  angry: { happy: 0, angry: 0.8, sad: 0, surprised: 0, relaxed: 0, neutral: 0 },
};

export class ExpressionController {
  private vrm: VRM;
  private currentEmotion: Emotion = "neutral";
  private transitionProgress = 1;
  private transitionSpeed = 0.05;
  private previousConfig: ExpressionConfig = EMOTION_MAP.neutral;
  private targetConfig: ExpressionConfig = EMOTION_MAP.neutral;

  // Idle animation
  private blinkTimer = 0;
  private blinkInterval = 4; // seconds between blinks
  private isBlinking = false;
  private blinkProgress = 0;

  constructor(vrm: VRM) {
    this.vrm = vrm;
  }

  setEmotion(emotion: Emotion): void {
    if (emotion === this.currentEmotion) return;
    this.previousConfig = { ...this.targetConfig };
    this.targetConfig = EMOTION_MAP[emotion];
    this.currentEmotion = emotion;
    this.transitionProgress = 0;
  }

  /**
   * Update expressions - call in requestAnimationFrame
   * @param delta Time delta in seconds
   */
  update(delta: number): void {
    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) return;

    // Transition between emotions
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(
        1,
        this.transitionProgress + this.transitionSpeed
      );
    }

    const t = easeOutCubic(this.transitionProgress);

    // Interpolate expression values
    const keys: (keyof ExpressionConfig)[] = [
      "happy",
      "angry",
      "sad",
      "surprised",
      "relaxed",
    ];
    for (const key of keys) {
      const value = lerp(this.previousConfig[key], this.targetConfig[key], t);
      expressionManager.setValue(key, value);
    }

    // Blink animation
    this.updateBlink(delta, expressionManager);
  }

  private updateBlink(
    delta: number,
    expressionManager: NonNullable<VRM["expressionManager"]>
  ): void {
    this.blinkTimer += delta;

    if (!this.isBlinking && this.blinkTimer >= this.blinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer = 0;
      // Randomize next blink interval
      this.blinkInterval = 3 + Math.random() * 4;
    }

    if (this.isBlinking) {
      this.blinkProgress += delta * 8; // blink speed

      let blinkValue: number;
      if (this.blinkProgress < 0.5) {
        // Closing
        blinkValue = this.blinkProgress * 2;
      } else if (this.blinkProgress < 1) {
        // Opening
        blinkValue = (1 - this.blinkProgress) * 2;
      } else {
        blinkValue = 0;
        this.isBlinking = false;
      }

      expressionManager.setValue("blink", blinkValue);
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
