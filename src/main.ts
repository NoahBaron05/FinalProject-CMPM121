import * as CANNON from "cannon-es";
import * as THREE from "three";
import "./style.css";

// Constants
const CAMERA_SPEED = 15; // units per second
const PHYSICS_TIME_STEP = 1 / 60;
const MAX_DELTA_TIME = 0.016;
const MOUSE_SENSITIVITY = 0.002;
const ROPE_SEGMENTS = 12; // number of rope segments
const ROPE_SEGMENT_LENGTH = 0.5; // distance between segments
const ROPE_ANCHOR_POINT = new CANNON.Vec3(0, 10, 0); // fixed top of rope
const BALL_RADIUS = 0.4;
const ROPE_SWING_FREQUENCY = 0.6; // swing frequency in Hz

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

interface RopeSegment {
  mesh: THREE.Mesh;
  body: CANNON.Body;
}

interface Rope {
  segments: RopeSegment[];
  segmentVisuals: THREE.Mesh[]; // cylinders connecting segments
  ballMesh: THREE.Mesh;
  ballBody: CANNON.Body;
  elapsedTime: number; // for swing animation
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

// Rope simulation functions
function createRope(
  scene: THREE.Scene,
  physicsWorld: CANNON.World,
): Rope {
  const rope: Rope = {
    segments: [],
    segmentVisuals: [],
    ballMesh: new THREE.Mesh(),
    ballBody: new CANNON.Body(),
  };

  // Create rope segments

  for (let i = 0; i < ROPE_SEGMENTS; i++) {
    const yOffset = -ROPE_SEGMENT_LENGTH * (i + 1);
    const position = new CANNON.Vec3(
      ROPE_ANCHOR_POINT.x,
      ROPE_ANCHOR_POINT.y + yOffset,
      ROPE_ANCHOR_POINT.z,
    );

    // Create small sphere for each segment
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0x8B4513, // brown rope color
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position as unknown as THREE.Vector3);
    scene.add(mesh);

    // Create physics body
    const shape = new CANNON.Sphere(0.15);
    const mass = i === 0 ? 0 : 0.2; // first segment is fixed/heavy, others are light
    const body = new CANNON.Body({
      mass,
      shape,
      linearDamping: 0.3,
      angularDamping: 0.3,
    });
    body.position.copy(position);
    physicsWorld.addBody(body);

    rope.segments.push({ mesh, body });

    // Connect segments with constraints
    if (i === 0) {
      // First segment: connect to anchor point with constraint
      const constraint = new CANNON.PointToPointConstraint(
        body,
        new CANNON.Vec3(0, 0, 0),
        new CANNON.Body({ mass: 0 }),
        ROPE_ANCHOR_POINT,
      );
      physicsWorld.addConstraint(constraint);
    } else {
      // Connect to previous segment with distance constraint
      const constraint = new CANNON.DistanceConstraint(
        rope.segments[i - 1].body,
        body,
        ROPE_SEGMENT_LENGTH,
      );
      physicsWorld.addConstraint(constraint);
    }
  }

  // Create ball at end of rope
  const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b }); // red ball
  rope.ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);

  const ballPosition = new CANNON.Vec3(
    ROPE_ANCHOR_POINT.x,
    ROPE_ANCHOR_POINT.y - ROPE_SEGMENT_LENGTH * ROPE_SEGMENTS,
    ROPE_ANCHOR_POINT.z,
  );
  rope.ballMesh.position.copy(ballPosition as unknown as THREE.Vector3);
  scene.add(rope.ballMesh);

  // Create physics body for ball
  const ballShape = new CANNON.Sphere(BALL_RADIUS);
  rope.ballBody = new CANNON.Body({
    mass: 0.5,
    shape: ballShape,
    linearDamping: 0.2,
    angularDamping: 0.2,
  });
  rope.ballBody.position.copy(ballPosition);
  physicsWorld.addBody(rope.ballBody);

  // Connect ball to last rope segment
  const ballConstraint = new CANNON.DistanceConstraint(
    rope.segments[ROPE_SEGMENTS - 1].body,
    rope.ballBody,
    ROPE_SEGMENT_LENGTH,
  );
  physicsWorld.addConstraint(ballConstraint);

  // Create visual cylinders connecting segments
  for (let i = 0; i < ROPE_SEGMENTS - 1; i++) {
    const cylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const cylinderMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    scene.add(cylinder);
    rope.segmentVisuals.push(cylinder);
  }

  // Final cylinder from last segment to ball
  const finalCylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
  const finalCylinder = new THREE.Mesh(finalCylinderGeometry, ballMaterial);
  scene.add(finalCylinder);
  rope.segmentVisuals.push(finalCylinder);

  rope.elapsedTime = 0;

  return rope;
}

// Apply swinging motion to rope
function applyRopeSwing(rope: Rope, deltaTime: number): void {
  rope.elapsedTime += deltaTime;

  // Calculate swing position using sine wave for smooth oscillation
  // Swing in X direction (left-right) at the anchor point
  const swingAmplitude = 1; // how far the anchor moves (in units)
  const anchorOffsetX = Math.sin(
    rope.elapsedTime * Math.PI * 2 * ROPE_SWING_FREQUENCY,
  ) * swingAmplitude;

  // Move the first rope segment to create the swinging motion from the top
  const firstSegment = rope.segments[0];
  firstSegment.body.position.x = ROPE_ANCHOR_POINT.x + anchorOffsetX;
  firstSegment.body.position.y = ROPE_ANCHOR_POINT.y;
  firstSegment.body.position.z = ROPE_ANCHOR_POINT.z;

  // Set velocity to match the position change for smooth motion
  const previousX = firstSegment.body.position.x;
  firstSegment.body.velocity.x =
    (anchorOffsetX - (previousX - ROPE_ANCHOR_POINT.x)) / deltaTime;
  firstSegment.body.velocity.y = 0;
  firstSegment.body.velocity.z = 0;
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
  rope: Rope | null,
  deltaTime: number,
): void {
  // Apply rope swinging before stepping physics
  if (rope) {
    applyRopeSwing(rope, deltaTime);
  }

  physicsWorld.step(PHYSICS_TIME_STEP, deltaTime, 3);

  for (const { mesh, body } of rigidBodies) {
    const cannonVec3 = body.position as unknown as THREE.Vector3;
    const cannonQuat = body.quaternion as unknown as THREE.Quaternion;
    mesh.position.copy(cannonVec3);
    mesh.quaternion.copy(cannonQuat);
  }

  // Update rope visuals
  if (rope) {
    // Update rope segment positions
    for (const segment of rope.segments) {
      const cannonVec3 = segment.body.position as unknown as THREE.Vector3;
      const cannonQuat = segment.body.quaternion as unknown as THREE.Quaternion;
      segment.mesh.position.copy(cannonVec3);
      segment.mesh.quaternion.copy(cannonQuat);
    }

    // Update ball position
    const ballPos = rope.ballBody.position as unknown as THREE.Vector3;
    const ballQuat = rope.ballBody.quaternion as unknown as THREE.Quaternion;
    rope.ballMesh.position.copy(ballPos);
    rope.ballMesh.quaternion.copy(ballQuat);

    // Update connecting cylinders
    for (let i = 0; i < rope.segmentVisuals.length; i++) {
      const cylinder = rope.segmentVisuals[i];

      // Determine start and end points
      let startPos: THREE.Vector3;
      let endPos: THREE.Vector3;

      if (i < rope.segments.length - 1) {
        startPos = rope.segments[i].mesh.position;
        endPos = rope.segments[i + 1].mesh.position;
      } else {
        startPos = rope.segments[rope.segments.length - 1].mesh.position;
        endPos = rope.ballMesh.position;
      }

      // Position cylinder at midpoint
      const midpoint = new THREE.Vector3().addVectors(startPos, endPos)
        .multiplyScalar(0.5);
      cylinder.position.copy(midpoint);

      // Calculate distance and rotate cylinder
      const distance = startPos.distanceTo(endPos);
      cylinder.scale.y = distance;

      // Rotate to point from start to end
      const direction = new THREE.Vector3().subVectors(endPos, startPos)
        .normalize();
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      cylinder.quaternion.copy(quaternion);
    }
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
  rope: Rope | null,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): () => void {
  return function animate(): void {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), MAX_DELTA_TIME);

    updateCamera(camera, cameraInput, deltaTime);
    updatePhysics(physicsWorld, rigidBodies, rope, deltaTime);

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
    const rope = createRope(scene, physicsWorld);

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
      rope,
      renderer,
      scene,
    );
    animate();

    console.log("✓ Scene initialized successfully with rope simulation");
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
