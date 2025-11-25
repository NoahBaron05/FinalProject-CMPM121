// @ts-expect-error - Deno cannot resolve types for npm:three
import * as THREE from "three";
import "./style.css";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(10, 10);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x808080,
  side: THREE.DoubleSide,
});

// @ts-ignore - MeshStandardMaterial is compatible with Mesh
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
scene.add(ground);

const camera = new THREE.PerspectiveCamera(
  75,
  globalThis.innerWidth / globalThis.innerHeight,
  0.1,
  1000,
);

camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

renderer.setPixelRatio(globalThis.devicePixelRatio);
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

globalThis.addEventListener("resize", () => {
  camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
});

animate();
