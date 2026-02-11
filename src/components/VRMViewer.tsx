"use client";

import { useEffect, useRef } from "react";
import type { Emotion } from "@/types";

interface VRMViewerProps {
  emotion: Emotion;
  isTalking: boolean;
  volume: number;
  vrmUrl: string;
}

export function VRMViewer({ emotion, isTalking, volume, vrmUrl }: VRMViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{
    scene: import("three").Scene;
    camera: import("three").PerspectiveCamera;
    renderer: import("three").WebGLRenderer;
    vrm: import("@pixiv/three-vrm").VRM | null;
    clock: import("three").Clock;
    idleAnimator: import("@/lib/avatar/idle-animation").IdleAnimator | null;
  } | null>(null);

  // Initialize scene once
  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId: number;

    async function init() {
      const THREE = await import("three");

      const canvas = canvasRef.current!;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f0a1e);

      const camera = new THREE.PerspectiveCamera(
        30,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        20
      );
      camera.position.set(0, 1.3, 2.5);
      camera.lookAt(0, 1.2, 0);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 2, 3);
      scene.add(directionalLight);
      const pinkLight = new THREE.PointLight(0xf472b6, 0.5, 10);
      pinkLight.position.set(-2, 1, 2);
      scene.add(pinkLight);
      const purpleLight = new THREE.PointLight(0xc084fc, 0.3, 10);
      purpleLight.position.set(2, 1, -1);
      scene.add(purpleLight);

      const clock = new THREE.Clock();
      rendererRef.current = { scene, camera, renderer, vrm: null, clock, idleAnimator: null };

      function animate() {
        animationId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const ref = rendererRef.current;
        if (ref?.idleAnimator) ref.idleAnimator.update(delta);
        if (ref?.vrm) ref.vrm.update(delta);
        renderer.render(scene, camera);
      }
      animate();

      const handleResize = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    init();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (rendererRef.current) {
        rendererRef.current.idleAnimator?.dispose();
        rendererRef.current.renderer.dispose();
      }
    };
  }, []);

  // Load VRM when vrmUrl changes
  useEffect(() => {
    if (!vrmUrl) return;

    let cancelled = false;

    async function loadVRM() {
      // Wait for scene to be ready
      const waitForScene = () =>
        new Promise<void>((resolve) => {
          const check = () => {
            if (rendererRef.current) resolve();
            else setTimeout(check, 50);
          };
          check();
        });
      await waitForScene();
      if (cancelled) return;

      const ref = rendererRef.current!;
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");
      const { IdleAnimator } = await import("@/lib/avatar/idle-animation");

      // Remove old VRM
      if (ref.idleAnimator) {
        ref.idleAnimator.dispose();
        ref.idleAnimator = null;
      }
      if (ref.vrm) {
        ref.scene.remove(ref.vrm.scene);
        ref.vrm = null;
      }

      try {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await loader.loadAsync(vrmUrl);
        if (cancelled) return;

        const vrm = gltf.userData.vrm;
        if (vrm) {
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);
          vrm.scene.rotation.y = Math.PI;
          ref.scene.add(vrm.scene);
          ref.vrm = vrm;
          ref.idleAnimator = new IdleAnimator(vrm);
        }
      } catch (e) {
        console.error("Failed to load VRM:", e);
      }
    }

    loadVRM();

    return () => {
      cancelled = true;
    };
  }, [vrmUrl]);

  // Update expression based on emotion
  useEffect(() => {
    const ref = rendererRef.current;
    if (!ref?.vrm?.expressionManager) return;

    const expressionManager = ref.vrm.expressionManager;

    // Reset all expressions
    expressionManager.setValue("happy", 0);
    expressionManager.setValue("angry", 0);
    expressionManager.setValue("sad", 0);
    expressionManager.setValue("surprised", 0);
    expressionManager.setValue("relaxed", 0);

    // Set current expression
    switch (emotion) {
      case "happy":
        expressionManager.setValue("happy", 1);
        break;
      case "sad":
        expressionManager.setValue("sad", 1);
        break;
      case "angry":
        expressionManager.setValue("angry", 1);
        break;
      case "surprised":
        expressionManager.setValue("surprised", 1);
        break;
      case "shy":
        expressionManager.setValue("relaxed", 0.7);
        expressionManager.setValue("happy", 0.3);
        break;
      case "neutral":
        expressionManager.setValue("relaxed", 0.3);
        break;
    }

    // Notify idle animator of emotion change for gesture reactions
    if (ref.idleAnimator) {
      ref.idleAnimator.setEmotion(emotion);
    }
  }, [emotion]);

  // Lip sync based on volume
  useEffect(() => {
    const ref = rendererRef.current;
    if (!ref?.vrm?.expressionManager) return;

    if (isTalking) {
      const mouthOpen = Math.min(volume / 128, 1) * 0.8;
      ref.vrm.expressionManager.setValue("aa", mouthOpen);
    } else {
      ref.vrm.expressionManager.setValue("aa", 0);
    }
  }, [isTalking, volume]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
