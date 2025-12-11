import * as CANNON from "cannon-es";
import * as THREE from "three";
import { Inventory } from "./Inventory.ts";
import { Rope } from "./main.ts";

export interface CameraInputLike {
  keys: Record<string, boolean>;
  mouseDelta: { x: number; y: number };
  isLooking: boolean;
}

export interface InitTouchControlOptions {
  input: CameraInputLike;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  physicsWorld: CANNON.World;
  inventory: Inventory;
  getRope: () => Rope | null;
  attemptCut: (
    camera: THREE.PerspectiveCamera,
    rope: Rope,
    physicsWorld: CANNON.World,
    scene: THREE.Scene,
    inventory: Inventory,
  ) => void;
  attemptPickup: (
    camera: THREE.Camera,
    scene: THREE.Scene,
    inventory: Inventory,
  ) => void;
  touchRadius?: number;
  tapThresholdMs?: number;
  lookSensitivity?: number;
}

// Initializes touch screen controls for movement and interaction
export function initTouchControls(opts: InitTouchControlOptions) {
  const {
    input,
    camera,
    scene,
    physicsWorld,
    inventory,
    getRope,
    attemptCut,
    attemptPickup,
    touchRadius = 80,
    tapThresholdMs = 220,
    lookSensitivity = 0.002,
  } = opts;

  // DOM elements
  const joystickBg = document.createElement("div");
  const joystickThumb = document.createElement("div");
  const actionHint = document.createElement("div");

  joystickBg.id = "touch-joystick-bg";
  joystickThumb.id = "touch-joystick-thumb";
  actionHint.id = "touch-action-hint";
  actionHint.innerText = "Tap: interact";

  joystickBg.appendChild(joystickThumb);
  document.body.appendChild(joystickBg);
  document.body.appendChild(actionHint);

  // Touch state
  let leftTouchId: number | null = null;
  let rightTouchId: number | null = null;
  let leftOrigin = { x: 0, y: 0 };
  let rightPrev = { x: 0, y: 0 };
  let rightTouchStart = 0;
  const ignoredTouches = new Set<number>();

  function setMovementFromVector(nx: number, ny: number) {
    const dead = 0.25;
    // ny negative = forward
    input.keys["w"] = ny < -dead;
    input.keys["s"] = ny > dead;
    input.keys["a"] = nx < -dead;
    input.keys["d"] = nx > dead;
  }

  function resetMovementKeys() {
    input.keys["w"] = false;
    input.keys["s"] = false;
    input.keys["a"] = false;
    input.keys["d"] = false;
  }

  function showJoystickAt(x: number, y: number) {
    joystickBg.style.display = "block";
    joystickBg.style.left = `${Math.max(8, x - touchRadius)}px`;
    joystickBg.style.bottom = `${
      Math.max(8, globalThis.innerHeight - y - touchRadius)
    }px`;
    joystickBg.style.opacity = "1";
  }

  function hideJoystick() {
    joystickBg.style.opacity = "0";
    setTimeout(() => {
      joystickBg.style.display = "none";
    }, 150);
  }

  // Handle both touchstart and touchcancel
  function onTouchStart(e: TouchEvent) {
    let handled = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i)!;
      const x = t.clientX;
      const y = t.clientY;
      const target = t.target as HTMLElement | null;
      const isUI = !!target &&
        (target.tagName === "SELECT" ||
          target.tagName === "INPUT" ||
          target.tagName === "BUTTON" ||
          !!target.closest?.("#language-selector") ||
          !!target.closest?.("#inventory"));

      if (isUI) {
        ignoredTouches.add(t.identifier);
        continue;
      }

      if (x < globalThis.innerWidth / 2 && leftTouchId === null) {
        // start joystick
        leftTouchId = t.identifier;
        leftOrigin = { x, y };
        joystickThumb.style.transform = `translate(0px, 0px)`;
        showJoystickAt(x, y);
        handled = true;
      } else if (x >= globalThis.innerWidth / 2 && rightTouchId === null) {
        rightTouchId = t.identifier;
        rightPrev = { x, y };
        rightTouchStart = performance.now();
        input.isLooking = true;
        handled = true;
      }
    }
    if (handled) {
      e.preventDefault();
    }
  }

  // Handle both touchmove and touchcancel
  function onTouchMove(e: TouchEvent) {
    let handled = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i)!;
      if (ignoredTouches.has(t.identifier)) continue;
      const x = t.clientX;
      const y = t.clientY;
      if (leftTouchId !== null && t.identifier === leftTouchId) {
        const dx = x - leftOrigin.x;
        const dy = y - leftOrigin.y;
        const nx = Math.max(-1, Math.min(1, dx / touchRadius));
        const ny = Math.max(-1, Math.min(1, dy / touchRadius));
        joystickThumb.style.transform = `translate(${
          nx * (touchRadius - 24)
        }px, ${ny * (touchRadius - 24)}px)`;
        setMovementFromVector(nx, ny);
        handled = true;
      } else if (rightTouchId !== null && t.identifier === rightTouchId) {
        const mx = (rightPrev.x - x) * lookSensitivity;
        const my = (rightPrev.y - y) * lookSensitivity;
        input.mouseDelta.x += mx;
        input.mouseDelta.y += my;
        rightPrev = { x, y };
        handled = true;
      }
    }
    if (handled) {
      e.preventDefault();
    }
  }

  // Handle both touchend and touchcancel
  function onTouchEnd(e: TouchEvent) {
    let handled = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i)!;
      if (ignoredTouches.has(t.identifier)) {
        ignoredTouches.delete(t.identifier);
        continue;
      }
      const _x = t.clientX;
      const _y = t.clientY;
      if (leftTouchId !== null && t.identifier === leftTouchId) {
        leftTouchId = null;
        joystickThumb.style.transform = `translate(0px, 0px)`;
        resetMovementKeys();
        hideJoystick();
        handled = true;
      } else if (rightTouchId !== null && t.identifier === rightTouchId) {
        const wasTap = performance.now() - rightTouchStart < tapThresholdMs;
        if (wasTap) {
          const rope = getRope();
          if (rope) {
            try {
              attemptCut(camera, rope, physicsWorld, scene, inventory);
            } catch (err) {
              console.warn("attemptCut error:", err);
            }
          }
          try {
            attemptPickup(camera, scene, inventory);
          } catch (err) {
            console.warn("attemptPickup error:", err);
          }
        }
        rightTouchId = null;
        input.isLooking = false;
        handled = true;
      }
    }
    if (handled) {
      e.preventDefault();
    }
  }

  document.addEventListener("touchstart", onTouchStart, { passive: false });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  document.addEventListener("touchend", onTouchEnd, { passive: false });
  document.addEventListener("touchcancel", onTouchEnd, { passive: false });

  // Cleanup function
  function dispose() {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", onTouchEnd);
    joystickBg.remove();
    joystickThumb.remove();
    actionHint.remove();
    resetMovementKeys();
  }

  return { dispose };
}
