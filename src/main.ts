import * as CANNON from "cannon-es";
import * as THREE from "three";
import "./style.css";

// Constants
const CAMERA_SPEED = 15; // units per second
const PHYSICS_TIME_STEP = 1 / 60;
const MAX_DELTA_TIME = 0.016;
const MOUSE_SENSITIVITY = 0.002;

// Type definitions
interface RigidBodyPair {
  mesh: THREE.Mesh;
  body: CANNON.Body;
}

interface CameraInput {
  keys: Record<string, boolean>;
  mouseDelta: { x: number; y: number };
  isLooking: boolean;
  pitch: number;
  yaw: number;
}

interface HtmlElement extends HTMLElement {
  requestPointerLock?: () => void;
}

// Scene setup functions
function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);
  return scene;
}

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    75,
    globalThis.innerWidth / globalThis.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 5, 10);
  return camera;
}

function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  renderer.setPixelRatio(globalThis.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

function setupLighting(scene: THREE.Scene): void {
  const light = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(light);
}

// Physics setup functions
function createPhysicsWorld(): CANNON.World {
  const world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);
  return world;
}

function createGround(
  scene: THREE.Scene,
  physicsWorld: CANNON.World,
): RigidBodyPair {
  // Visual mesh
  const geometry = new THREE.PlaneGeometry(100, 100);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Physics body
  const shape = new CANNON.Plane();
  const body = new CANNON.Body({
    mass: 0,
    shape,
    linearDamping: 0.3,
    angularDamping: 0.3,
  });
  body.position.set(0, 0, 0);
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  physicsWorld.addBody(body);

  return { mesh, body };
}

function createCube(
  scene: THREE.Scene,
  physicsWorld: CANNON.World,
): RigidBodyPair {
  // Visual mesh
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 5;
  scene.add(mesh);

  // Physics body
  const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
  const body = new CANNON.Body({
    mass: 1,
    shape,
    linearDamping: 0.3,
    angularDamping: 0.3,
  });
  body.position.set(0, 5, 0);
  physicsWorld.addBody(body);

  return { mesh, body };
}

// Camera input setup
function setupCameraInput(): CameraInput {
  const input: CameraInput = {
    keys: {},
    mouseDelta: { x: 0, y: 0 },
    isLooking: false,
    pitch: 0,
    yaw: 0,
  };

  globalThis.addEventListener("keydown", (e: KeyboardEvent) => {
    input.keys[e.key.toLowerCase()] = true;
  });

  globalThis.addEventListener("keyup", (e: KeyboardEvent) => {
    input.keys[e.key.toLowerCase()] = false;
  });

  globalThis.addEventListener("mousemove", (e: MouseEvent) => {
    if (input.isLooking) {
      input.mouseDelta.x += e.movementX * MOUSE_SENSITIVITY;
      input.mouseDelta.y += e.movementY * MOUSE_SENSITIVITY;
    }
  });

  globalThis.addEventListener("mousedown", () => {
    input.isLooking = true;
  });

  globalThis.addEventListener("mouseup", () => {
    input.isLooking = false;
  });

  document.addEventListener("click", () => {
    if (document.pointerLockElement !== document.body) {
      const elem = document.body as HtmlElement;
      elem.requestPointerLock?.();
    }
  });

  return input;
}

// Camera update function
function updateCamera(
  camera: THREE.PerspectiveCamera,
  input: CameraInput,
  deltaTime: number,
): void {
  // Movement
  const directions = {
    w: new THREE.Vector3(0, 0, -1),
    s: new THREE.Vector3(0, 0, 1),
    a: new THREE.Vector3(-1, 0, 0),
    d: new THREE.Vector3(1, 0, 0),
  };

  for (const [key, direction] of Object.entries(directions)) {
    if (input.keys[key]) {
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);
      camera.position.addScaledVector(direction, CAMERA_SPEED * deltaTime);
    }
  }

  if (input.keys[" "]) {
    camera.position.y += CAMERA_SPEED * deltaTime;
  }
  if (input.keys["shift"]) {
    camera.position.y -= CAMERA_SPEED * deltaTime;
  }

  // Rotation
  input.yaw += input.mouseDelta.x;
  input.pitch += input.mouseDelta.y;
  input.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, input.pitch));
  input.mouseDelta.x = 0;
  input.mouseDelta.y = 0;

  camera.rotation.order = "YXZ";
  camera.rotation.y = input.yaw;
  camera.rotation.x = input.pitch;
}

// Physics update function
function updatePhysics(
  physicsWorld: CANNON.World,
  rigidBodies: RigidBodyPair[],
  deltaTime: number,
): void {
  physicsWorld.step(PHYSICS_TIME_STEP, deltaTime, 3);

  for (const { mesh, body } of rigidBodies) {
    const cannonVec3 = body.position as unknown as THREE.Vector3;
    const cannonQuat = body.quaternion as unknown as THREE.Quaternion;
    mesh.position.copy(cannonVec3);
    mesh.quaternion.copy(cannonQuat);
  }
}

// Handle window resize
function setupResizeHandler(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): void {
  globalThis.addEventListener("resize", () => {
    const width = globalThis.innerWidth;
    const height = globalThis.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
}

// Animation loop
function createAnimationLoop(
  clock: THREE.Clock,
  camera: THREE.PerspectiveCamera,
  cameraInput: CameraInput,
  physicsWorld: CANNON.World,
  rigidBodies: RigidBodyPair[],
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): () => void {
  return function animate(): void {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), MAX_DELTA_TIME);

    updateCamera(camera, cameraInput, deltaTime);
    updatePhysics(physicsWorld, rigidBodies, deltaTime);

    renderer.render(scene, camera);
  };
}

// Main initialization
function initScene(): void {
  try {
    // Setup scene
    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    setupLighting(scene);
    setupResizeHandler(camera, renderer);

    // Setup physics
    const physicsWorld = createPhysicsWorld();
    const rigidBodies: RigidBodyPair[] = [];

    // Create objects
    createGround(scene, physicsWorld);
    rigidBodies.push(createCube(scene, physicsWorld));

    // Setup input
    const cameraInput = setupCameraInput();

    // Animation loop
    const clock = new THREE.Clock();
    const animate = createAnimationLoop(
      clock,
      camera,
      cameraInput,
      physicsWorld,
      rigidBodies,
      renderer,
      scene,
    );
    animate();

    console.log("✓ Scene initialized successfully");
  } catch (error) {
    console.error("❌ Error during initialization:", error);
  }
}

// Start application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initScene);
} else {
  initScene();
}
