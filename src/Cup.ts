import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Cup {
  mesh: THREE.Group;
  walls: CANNON.Body[] = [];
  bottomBody: CANNON.Body;
  hasScored = false;
  ball: CANNON.Body | null = null;

  constructor(
    scene: THREE.Scene,
    physicsWorld: CANNON.World,
    position = new THREE.Vector3(3, 0.5, 0),
  ) {
    this.mesh = new THREE.Group();

    //git push Makes Cone Brown
    const basketMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // brown color
      metalness: 0.1,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });

    // Creates Parabola shape (Edit this to change cone shape)
    const height = 3.5;
    const bottomRadius = 0.4;
    const topRadius = 2.2;
    const steps = 40;

    const curvePoints: THREE.Vector2[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      const y = -height / 2 + t * height;

      // Parabola (Formula) r = a * t^2 + b
      const a = topRadius - bottomRadius;
      const r = bottomRadius + a * (t * t);

      curvePoints.push(new THREE.Vector2(r, y));
    }

    const lathe = new THREE.LatheGeometry(curvePoints, 60);
    const coneMesh = new THREE.Mesh(lathe, basketMaterial);
    coneMesh.position.copy(position);
    this.mesh.add(coneMesh);

    scene.add(this.mesh);

    // oop to make parabola mech walls
    const wallThickness = 0.12;

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;

      const r = topRadius - 0.15;
      const wallShape = new CANNON.Box(
        new CANNON.Vec3(r / 2, height / 2, wallThickness / 2),
      );

      const wallBody = new CANNON.Body({ mass: 0 });
      wallBody.addShape(wallShape);

      const x = position.x + Math.cos(angle) * (r * 0.7);
      const z = position.z + Math.sin(angle) * (r * 0.7);

      wallBody.position.set(x, position.y, z);
      wallBody.quaternion.setFromEuler(0, angle, Math.PI * 0.22);

      physicsWorld.addBody(wallBody);
      this.walls.push(wallBody);
    }

    // Bottom collision circle
    const bottomShape = new CANNON.Cylinder(
      bottomRadius,
      bottomRadius,
      0.25,
      12,
    );
    this.bottomBody = new CANNON.Body({ mass: 0 });
    this.bottomBody.addShape(bottomShape);
    this.bottomBody.position.set(
      position.x,
      position.y - height / 2,
      position.z,
    );
    this.bottomBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    physicsWorld.addBody(this.bottomBody);

    // Collision Detection
    physicsWorld.addEventListener("postStep", () => {
      this.checkBallCollision();
    });
  }

  attachBall(ball: CANNON.Body) {
    this.ball = ball;
  }

  checkBallCollision() {
    if (this.hasScored || !this.ball) return;

    const dist = this.ball.position.distanceTo(this.bottomBody.position);

    if (dist < 0.9) {
      this.hasScored = true;

      // Make cone glow blue
      this.mesh.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.emissive = new THREE.Color(0x0000ff);
          mat.emissiveIntensity = 1.2;
        }
      });
    }
  }

  update() {}
}
