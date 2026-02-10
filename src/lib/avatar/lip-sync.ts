import type { VRM } from "@pixiv/three-vrm";

export class LipSync {
  private vrm: VRM;
  private currentMouthOpen = 0;
  private targetMouthOpen = 0;
  private smoothingFactor = 0.3;

  constructor(vrm: VRM) {
    this.vrm = vrm;
  }

  /**
   * Update lip sync based on audio volume
   * @param volume 0-255 range
   */
  updateFromVolume(volume: number): void {
    // Normalize volume to 0-1 range and apply threshold
    const normalized = Math.max(0, (volume - 10) / 120);
    this.targetMouthOpen = Math.min(normalized, 1) * 0.8;
  }

  /**
   * Update animation frame - call in requestAnimationFrame
   */
  update(): void {
    // Smooth interpolation
    this.currentMouthOpen +=
      (this.targetMouthOpen - this.currentMouthOpen) * this.smoothingFactor;

    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) return;

    // Use 'aa' expression for mouth open
    expressionManager.setValue("aa", this.currentMouthOpen);

    // Add slight 'oh' shape for variety when mouth is partially open
    if (this.currentMouthOpen > 0.2 && this.currentMouthOpen < 0.6) {
      expressionManager.setValue("oh", this.currentMouthOpen * 0.3);
    } else {
      expressionManager.setValue("oh", 0);
    }
  }

  /**
   * Close mouth
   */
  stop(): void {
    this.targetMouthOpen = 0;
  }
}
