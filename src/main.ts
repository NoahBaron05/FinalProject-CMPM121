import * as CANNON from "cannon-es";
import * as THREE from "three";
import { Cup } from "./Cup.ts";
import { Inventory, InventoryUI } from "./Inventory.ts";
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

type GameState = "INTRO" | "GAME";

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
  ballConstraint?: CANNON.Constraint;
  constraints: CANNON.Constraint[];
}

const state = {
  current: "INTRO" as GameState,
  introObjects: [] as THREE.Object3D[],
  doorPosition: new THREE.Vector3(0, 2, -10),
};

export const inventoryUI = new InventoryUI();

function createCanvasTexture(
  text: string,
  subText: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(0, 0, 512, 512);

  // Text
  ctx.fillStyle = "black";
  ctx.textAlign = "center";

  ctx.font = "bold 40px Arial";
  ctx.fillText(text, 256, 200);

  ctx.font = "20px Arial";
  const lines = subText.split("\n");
  let y = 250;
  for (const line of lines) {
    ctx.fillText(line, 256, y);
    y += 30;
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Scene setup functions
function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);
  return scene;
}

/*
function createCrosshair() {
  const crosshair = document.createElement("div");
  crosshair.style.position = "absolute";
  crosshair.style.top = "50%";
  crosshair.style.left = "50%";
  crosshair.style.width = "10px";
  crosshair.style.height = "10px";
  crosshair.style.backgroundColor = "white";
  crosshair.style.border = "1px solid black";
  crosshair.style.borderRadius = "50%";
  crosshair.style.transform = "translate(-50%, -50%)";
  crosshair.style.pointerEvents = "none"; // Important: lets clicks pass through to the canvas
  crosshair.style.zIndex = "100";
  document.body.appendChild(crosshair);
}
*/

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

function createCrosshair() {
  const crosshair = document.createElement("div");
  Object.assign(crosshair.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "10px",
    height: "10px",
    backgroundColor: "white",
    border: "1px solid black",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: "100",
  });
  document.body.appendChild(crosshair);
}
/*
function setupLighting(scene: THREE.Scene): void {
  const light = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(light);
}
*/

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

function loadIntroLevel(scene: THREE.Scene, physicsWorld: CANNON.World) {
  state.current = "INTRO";

  // 1. Credits Wall (Left)
  const creditsGeo = new THREE.BoxGeometry(0.5, 4, 4);
  const creditsMat = new THREE.MeshStandardMaterial({
    map: createCanvasTexture(
      "CREDITS",
      "Created by: Guys can you all enter your name here, Mahir Camci",
    ),
  });
  const creditsWall = new THREE.Mesh(creditsGeo, creditsMat);
  creditsWall.position.set(-5, 2, 0);
  scene.add(creditsWall);
  state.introObjects.push(creditsWall);

  // 2. Instructions Wall (Right)
  const instrGeo = new THREE.BoxGeometry(0.5, 4, 4);
  const instrMat = new THREE.MeshStandardMaterial({
    map: createCanvasTexture(
      "HOW TO PLAY",
      "WASD to Move\nMouse to Look\nSpace/Click to Cut Rope\nGoal: Drop ball in Cup",
    ),
  });
  const instrWall = new THREE.Mesh(instrGeo, instrMat);
  instrWall.position.set(5, 2, 0);
  scene.add(instrWall);
  state.introObjects.push(instrWall);

  // 3. The Door (Front)
  const doorGeo = new THREE.BoxGeometry(3, 5, 0.5);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5,
  });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.copy(state.doorPosition);
  scene.add(door);
  state.introObjects.push(door);

  // Add a label above door
  const labelGeo = new THREE.PlaneGeometry(3, 1);
  const labelMat = new THREE.MeshBasicMaterial({
    map: createCanvasTexture("ENTER LEVEL 1", "Walk through to start"),
    side: THREE.DoubleSide,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 5, -10);
  scene.add(label);
  state.introObjects.push(label);

  const knife = spawnKnife(scene, physicsWorld);
  state.introObjects.push(knife.mesh);
}

function createRope(
  scene: THREE.Scene,
  physicsWorld: CANNON.World,
): Rope {
  const rope: Rope = {
    segments: [],
    segmentVisuals: [],
    ballMesh: new THREE.Mesh(),
    ballBody: new CANNON.Body(),
    constraints: [],
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
      linearDamping: 0.1,
      angularDamping: 0.1,
    });
    body.position.copy(position);
    physicsWorld.addBody(body);

    rope.segments.push({ mesh, body });

    let _constraint: CANNON.Constraint;

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
      rope.constraints.push(constraint);
    } else {
      // Connect to previous segment with distance constraint
      const constraint = new CANNON.DistanceConstraint(
        rope.segments[i - 1].body,
        body,
        ROPE_SEGMENT_LENGTH,
      );
      physicsWorld.addConstraint(constraint);
      rope.ballConstraint = constraint;
      rope.constraints.push(constraint);
    }
  }

  // Ball
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
    mass: 1.5,
    shape: ballShape,
    linearDamping: 0.1,
    angularDamping: 0.1,
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

function applyRopeSwing(rope: Rope, deltaTime: number) {
  if (!rope.ballConstraint || deltaTime <= 0) return;
  rope.elapsedTime += deltaTime;
  const targetX = ROPE_ANCHOR_POINT.x +
    Math.sin(rope.elapsedTime * Math.PI * 2 * ROPE_SWING_FREQUENCY) * 2;
  const desiredVelX = (targetX - rope.ballBody.position.x) / deltaTime;
  rope.ballBody.velocity.x = Math.max(-50, Math.min(50, desiredVelX));
  rope.ballBody.velocity.y *= 0.98;
  rope.ballBody.velocity.z *= 0.98;
}

function attemptCut(
  camera: THREE.PerspectiveCamera,
  rope: Rope,
  physicsWorld: CANNON.World,
  scene: THREE.Scene,
  inventory: Inventory,
) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(
    rope.segments.map((s) => s.mesh),
  );

  if (intersects.length > 0) {
    if (!inventory.has("knife")) {
      console.log("❌ You need a knife to cut the rope!");
      return;
    }

    const obj = intersects[0].object;
    const index = rope.segments.findIndex((s) => s.mesh === obj);

    if (index !== -1 && rope.constraints[index]) {
      physicsWorld.removeConstraint(rope.constraints[index]);
      delete rope.constraints[index];

      // Detach below
      for (let i = index; i < rope.segments.length; i++) {
        physicsWorld.removeBody(rope.segments[i].body);
        scene.remove(rope.segments[i].mesh);
      }
      for (let i = index; i < rope.segmentVisuals.length; i++) {
        scene.remove(rope.segmentVisuals[i]);
      }
      if (rope.ballConstraint) {
        physicsWorld.removeConstraint(rope.ballConstraint);
        rope.ballConstraint = undefined;
      }

      rope.segments.splice(index, rope.segments.length - index);
      rope.segmentVisuals.splice(index, rope.segmentVisuals.length - index);
      console.log(`✂️ Cut rope at segment ${index}!`);
    }
  }
}

const pickupRaycaster = new THREE.Raycaster();

function attemptPickup(
  camera: THREE.Camera,
  scene: THREE.Scene,
  inventory: Inventory,
) {
  pickupRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const intersects = pickupRaycaster.intersectObjects(scene.children, true);

  if (intersects.length === 0) return;

  const hit = intersects[0].object;

  // Only pick up actual pick-up items
  if (!hit.userData.isPickup) return;

  const itemId = hit.userData.itemId;
  if (!itemId) return;

  // Add to inventory
  inventory.add(itemId);
  inventoryUI.update(inventory);

  // Remove from scene
  hit.parent?.remove(hit);

  // Remove physics body if exists
  if (hit.userData.body) {
    hit.userData.body.world?.removeBody(hit.userData.body);
  }
}

function handleInput(
  input: CameraInput,
  rope: Rope,
  world: CANNON.World,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  cup: Cup,
  mouseWasPressed: boolean,
  inventory: Inventory,
): boolean {
  // Spacebar Cut Logic
  if (input.keys[" "] && rope.ballConstraint && inventory.has("knife")) {
    world.removeConstraint(rope.ballConstraint);

    const lastSegment = rope.segments[rope.segments.length - 1];
    world.removeBody(lastSegment.body);
    scene.remove(lastSegment.mesh);
    rope.segments.pop();

    const visual = rope.segmentVisuals.pop();
    if (visual) scene.remove(visual);

    rope.ballConstraint = undefined;
  }

  // Reset
  if (input.keys["reset"]) {
    resetSimulation(scene, world, rope, cup);
    input.keys["reset"] = false;
  }

  // Click Cut
  let pressed = mouseWasPressed;
  if (input.isLooking && !pressed) {
    attemptCut(camera, rope, world, scene, inventory);
    attemptPickup(camera, scene, inventory);
    pressed = true;
  }
  if (!input.isLooking) {
    pressed = false;
  }
  return pressed;
}

// --- Input & Cameras ---
function setupCameraInput(): CameraInput {
  const input: CameraInput = {
    keys: {},
    mouseDelta: { x: 0, y: 0 },
    isLooking: false,
    pitch: 0,
    yaw: 0,
  };
  globalThis.addEventListener("keydown", (e) => {
    input.keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "r") input.keys["reset"] = true;
  });
  globalThis.addEventListener(
    "keyup",
    (e) => input.keys[e.key.toLowerCase()] = false,
  );
  globalThis.addEventListener("mousemove", (e) => {
    if (input.isLooking) {
      input.mouseDelta.x += e.movementX * MOUSE_SENSITIVITY;
      input.mouseDelta.y += e.movementY * MOUSE_SENSITIVITY;
    }
  });
  globalThis.addEventListener("mousedown", () => input.isLooking = true);
  globalThis.addEventListener("mouseup", () => input.isLooking = false);
  document.addEventListener("click", () => {
    if (document.pointerLockElement !== document.body) {
      (document.body as HtmlElement).requestPointerLock?.();
    }
  });
  return input;
}

function updateCamera(
  camera: THREE.PerspectiveCamera,
  input: CameraInput,
  deltaTime: number,
) {
  const direction = new THREE.Vector3();
  const front = new THREE.Vector3(0, 0, -1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    input.yaw,
  );
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    input.yaw,
  );

  if (input.keys["w"]) direction.add(front);
  if (input.keys["s"]) direction.sub(front);
  if (input.keys["a"]) direction.sub(right);
  if (input.keys["d"]) direction.add(right);

  camera.position.addScaledVector(
    direction.normalize(),
    CAMERA_SPEED * deltaTime,
  );
  if (input.keys["shift"]) camera.position.y -= CAMERA_SPEED * deltaTime;

  input.yaw += input.mouseDelta.x;
  input.pitch = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, input.pitch + input.mouseDelta.y),
  );
  input.mouseDelta = { x: 0, y: 0 };
  camera.rotation.set(input.pitch, input.yaw, 0, "YXZ");
}

function updatePhysics(
  world: CANNON.World,
  bodies: RigidBodyPair[],
  rope: Rope | null,
  deltaTime: number,
  _scene: THREE.Scene,
) {
  if (rope) {
    applyRopeSwing(rope, deltaTime);

    // Sync Bodies
    for (const seg of rope.segments) {
      seg.mesh.position.copy(seg.body.position as unknown as THREE.Vector3);
      seg.mesh.quaternion.copy(
        seg.body.quaternion as unknown as THREE.Quaternion,
      );
    }
    rope.ballMesh.position.copy(
      rope.ballBody.position as unknown as THREE.Vector3,
    );
    rope.ballMesh.quaternion.copy(
      rope.ballBody.quaternion as unknown as THREE.Quaternion,
    );

    // Sync Visuals
    for (let i = 0; i < rope.segmentVisuals.length; i++) {
      const cyl = rope.segmentVisuals[i];

      let start: THREE.Vector3, end: THREE.Vector3;
      let isConnected = true;

      if (i < rope.segments.length - 1) {
        start = rope.segments[i].mesh.position;
        end = rope.segments[i + 1].mesh.position;
        if (!rope.constraints[i + 1]) isConnected = false;
      } else {
        // Connection to ball
        start = rope.segments[rope.segments.length - 1].mesh.position;
        end = rope.ballMesh.position;
        if (!rope.ballConstraint) isConnected = false;
      }

      cyl.visible = isConnected;
      if (isConnected) {
        cyl.position.copy(
          new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
        );
        cyl.scale.y = start.distanceTo(end);
        cyl.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3().subVectors(end, start).normalize(),
        );
      }
    }
  }

  world.step(PHYSICS_TIME_STEP, deltaTime, 3);

  for (const { mesh, body } of bodies) {
    mesh.position.copy(body.position as unknown as THREE.Vector3);
    mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
  }
}

function spawnKnife(scene: THREE.Scene, physicsWorld: CANNON.World) {
  // --- 3D mesh ---
  const knifeGeometry = new THREE.BoxGeometry(1, 0.1, 3);
  const knifeMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const knifeMesh = new THREE.Mesh(knifeGeometry, knifeMaterial);

  // Position the mesh in the world
  const knifePosition = new THREE.Vector3(0, 1, 0);
  knifeMesh.position.copy(knifePosition);
  scene.add(knifeMesh);

  // Mark as pickup
  knifeMesh.userData.isPickup = true;
  knifeMesh.userData.itemId = "knife";

  // --- Physics body ---
  const knifeShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.05, 1.5)); // half-sizes match geometry
  const knifeBody = new CANNON.Body({ mass: 0.2 });
  knifeBody.addShape(knifeShape);
  knifeBody.position.copy(knifePosition as unknown as CANNON.Vec3); // same position as mesh
  physicsWorld.addBody(knifeBody);

  // Link body to mesh for removal on pickup
  knifeMesh.userData.body = knifeBody;

  return { mesh: knifeMesh, body: knifeBody };
}

function resetSimulation(
  scene: THREE.Scene,
  physicsWorld: CANNON.World,
  rope: Rope,
  cup: Cup,
) {
  // 1. Remove all old physics bodies
  for (const seg of rope.segments) {
    physicsWorld.removeBody(seg.body);
    scene.remove(seg.mesh);
  }

  physicsWorld.removeBody(rope.ballBody);
  scene.remove(rope.ballMesh);

  // 2. Remove all constraints
  for (const c of rope.constraints) {
    if (c) physicsWorld.removeConstraint(c);
  }
  if (rope.ballConstraint) physicsWorld.removeConstraint(rope.ballConstraint);

  // 3. Remove all visual cylinders
  for (const v of rope.segmentVisuals) {
    scene.remove(v);
  }

  rope.segments = [];
  rope.constraints = [];
  rope.segmentVisuals = [];
  rope.elapsedTime = 0;
  rope.ballConstraint = undefined;

  // 4. Rebuild rope entirely using createRope()
  const newRope = createRope(scene, physicsWorld);

  // 5. Re-attach new ball to cup
  cup.attachBall(newRope.ballBody);

  // Copy new values into original rope reference
  Object.assign(rope, newRope);
}

// --- Main Init ---
function initScene() {
  const scene = createScene();
  createCrosshair();
  const camera = createCamera();
  const renderer = createRenderer();
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  globalThis.addEventListener("resize", () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  });

  const physicsWorld = createPhysicsWorld();
  const rigidBodies: RigidBodyPair[] = [];

  // Create Ground immediately (shared across levels)
  createGround(scene, physicsWorld);

  // Load INTRO first
  loadIntroLevel(scene, physicsWorld);

  const input = setupCameraInput();
  const clock = new THREE.Clock();

  // Variables that will be populated when Game Starts
  let rope: Rope | null = null;
  let cup: Cup | undefined = undefined;
  let mouseWasPressed = false;

  // Setup inventory
  const inventory = new Inventory();

  function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), MAX_DELTA_TIME);
    updateCamera(camera, input, deltaTime);

    // STATE MACHINE
    if (state.current === "INTRO") {
      // Attempt pickup every frame
      attemptPickup(camera, scene, inventory);

      // Check distance to door
      const dx = camera.position.x - state.doorPosition.x;
      const dz = camera.position.z - state.doorPosition.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2.0) {
        console.log("Entering Level 1...");
        state.current = "GAME";

        state.introObjects.forEach((obj) => scene.remove(obj));
        state.introObjects = [];

        rope = createRope(scene, physicsWorld);
        cup = new Cup(
          scene,
          physicsWorld,
          new THREE.Vector3(3, -0.5, 0),
          () => document.getElementById("win-text")?.classList.add("show"),
        );
        cup.attachBall(rope.ballBody);

        camera.position.set(0, 5, 10);
      }
    } else if (state.current === "GAME") {
      updatePhysics(physicsWorld, rigidBodies, rope, deltaTime, scene);
      if (cup) cup.update();

      if (rope && cup) {
        mouseWasPressed = handleInput(
          input,
          rope,
          physicsWorld,
          camera,
          scene,
          cup,
          mouseWasPressed,
          inventory,
        );
      }

      if (input.keys["reset"] && rope && cup) {
        globalThis.location.reload();
      }
    }

    renderer.render(scene, camera);
  }

  animate();
}

initScene();
