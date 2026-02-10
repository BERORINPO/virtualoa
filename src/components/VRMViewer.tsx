"use client";

import { useEffect, useRef } from "react";
import type { Emotion } from "@/types";

interface VRMViewerProps {
  emotion: Emotion;
  isTalking: boolean;
  volume: number;
}

const EMOTION_COLORS: Record<Emotion, string> = {
  happy: "#f472b6",
  surprised: "#fbbf24",
  shy: "#f9a8d4",
  sad: "#60a5fa",
  neutral: "#c084fc",
  angry: "#ef4444",
};

const EMOTION_LABELS: Record<Emotion, string> = {
  happy: "😊 嬉しい",
  surprised: "😲 驚き",
  shy: "😳 照れ",
  sad: "😢 悲しい",
  neutral: "🙂 通常",
  angry: "😤 怒り",
};

export function VRMViewer({ emotion, isTalking, volume }: VRMViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{
    scene: import("three").Scene;
    camera: import("three").PerspectiveCamera;
    renderer: import("three").WebGLRenderer;
    vrm: import("@pixiv/three-vrm").VRM | null;
    clock: import("three").Clock;
    idleAnimator: import("@/lib/avatar/idle-animation").IdleAnimator | null;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId: number;

    async function init() {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");
      const { IdleAnimator } = await import("@/lib/avatar/idle-animation");

      const canvas = canvasRef.current!;
      const scene = new THREE.Scene();

      // Gradient background
      scene.background = new THREE.Color(0x0f0a1e);

      // Camera
      const camera = new THREE.PerspectiveCamera(
        30,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        20
      );
      camera.position.set(0, 1.3, 2.5);
      camera.lookAt(0, 1.2, 0);

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      // Lighting
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

      // Load VRM
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      let vrm: import("@pixiv/three-vrm").VRM | null = null;
      let idleAnimator: import("@/lib/avatar/idle-animation").IdleAnimator | null = null;

      try {
        const gltf = await loader.loadAsync("/models/girlfriend.vrm");
        vrm = gltf.userData.vrm;
        if (vrm) {
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);
          vrm.scene.rotation.y = Math.PI;
          scene.add(vrm.scene);
          idleAnimator = new IdleAnimator(vrm);
        }
      } catch {
        // VRM not found - show placeholder
        const geometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 16);
        const material = new THREE.MeshStandardMaterial({
          color: 0xf472b6,
          emissive: 0x831843,
          emissiveIntensity: 0.2,
        });
        const placeholder = new THREE.Mesh(geometry, material);
        placeholder.position.set(0, 1.2, 0);
        scene.add(placeholder);

        // Head
        const headGeom = new THREE.SphereGeometry(0.25, 16, 16);
        const head = new THREE.Mesh(headGeom, material);
        head.position.set(0, 1.9, 0);
        scene.add(head);
      }

      const clock = new THREE.Clock();
      rendererRef.current = { scene, camera, renderer, vrm, clock, idleAnimator };

      // Animation loop
      function animate() {
        animationId = requestAnimationFrame(animate);
        const delta = clock.getDelta();

        if (idleAnimator) {
          idleAnimator.update(delta);
        }
        if (vrm) {
          vrm.update(delta);
        }

        renderer.render(scene, camera);
      }
      animate();

      // Handle resize
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

      {/* Emotion indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: EMOTION_COLORS[emotion] }}
        />
        <span className="text-xs text-white/60">{EMOTION_LABELS[emotion]}</span>
      </div>

      {/* Talking indicator */}
      {isTalking && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-pink-400 rounded-full animate-pulse"
                style={{
                  height: `${8 + Math.random() * 16}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-white/60">Speaking</span>
        </div>
      )}
    </div>
  );
}
