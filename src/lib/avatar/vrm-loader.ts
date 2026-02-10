import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM, VRMUtils } from "@pixiv/three-vrm";

export async function loadVRM(url: string): Promise<VRM> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM;

  if (!vrm) {
    throw new Error("Failed to load VRM model");
  }

  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.removeUnnecessaryJoints(gltf.scene);

  // Rotate to face camera
  vrm.scene.rotation.y = Math.PI;

  return vrm;
}

export function createPlaceholderAvatar(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    emissive: 0x831843,
    emissiveIntensity: 0.2,
  });

  // Body
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.8, 4, 16),
    material
  );
  body.position.set(0, 1.2, 0);
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    material
  );
  head.position.set(0, 1.9, 0);
  group.add(head);

  scene.add(group);
  return group;
}
