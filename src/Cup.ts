import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Cup {
  mesh: THREE.Group;
  walls: CANNON.Body[] = [];
  bottomBody: CANNON.Body;
  hasScored = false;
  ball: CANNON.Body | null = null;

  // cup shape settings
  private readonly height = 3.5;
  private readonly bottomRadius = 0.4;
  private readonly topRadius = 2.2;
  private readonly steps = 40;
  private readonly wallCount = 6;
  private readonly wallThickness = 0.12;

  constructor(
    scene: THREE.Scene,
    physicsWorld: CANNON.World,
    position = new THREE.Vector3(3, 0.5, 0),
  ) {
    this.mesh = new THREE.Group();

    // Makes cone brown
    const basketMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      metalness: 0.1,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });

    // Creates parabola shape
    const cupMesh = this.createParabolaMesh(basketMaterial);
    cupMesh.position.copy(position);
    this.mesh.add(cupMesh);
    scene.add(this.mesh);

    // makes parabola collision walls
    this.createWalls(physicsWorld, position);

    // bottom collision
    this.bottomBody = this.createBottom(physicsWorld, position);

    // score detection
    physicsWorld.addEventListener("postStep", () => this.checkBall());
  }

  // parabola mesh
  private createParabolaMesh(material: THREE.Material): THREE.Mesh {
    const points: THREE.Vector2[] = [];

    for (let i = 0; i <= this.steps; i++) {
      const t = i / this.steps;
      const y = -this.height / 2 + t * this.height;

      // parabola math
      const r = this.bottomRadius +
        (this.topRadius - this.bottomRadius) * t * t;

      points.push(new THREE.Vector2(r, y));
    }

    const geo = new THREE.LatheGeometry(points, 60);
    return new THREE.Mesh(geo, material);
  }

  // cup collision walls
  private createWalls(world: CANNON.World, pos: THREE.Vector3) {
    const wallH = this.height;
    const wallR = this.topRadius - 0.15;

    for (let i = 0; i < this.wallCount; i++) {
      const angle = (i / this.wallCount) * Math.PI * 2;

      const shape = new CANNON.Box(
        new CANNON.Vec3(wallR / 2, wallH / 2, this.wallThickness / 2),
      );
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);

      const x = pos.x + Math.cos(angle) * (wallR * 0.7);
      const z = pos.z + Math.sin(angle) * (wallR * 0.7);

      body.position.set(x, pos.y, z);
      body.quaternion.setFromEuler(0, angle, Math.PI * 0.22);

      world.addBody(body);
      this.walls.push(body);
    }
  }

  // bottom collision circle
  private createBottom(world: CANNON.World, pos: THREE.Vector3): CANNON.Body {
    const shape = new CANNON.Cylinder(
      this.bottomRadius,
      this.bottomRadius,
      0.25,
      12,
    );
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(shape);

    body.position.set(pos.x, pos.y - this.height / 2, pos.z);
    body.quaternion.setFromEuler(Math.PI / 2, 0, 0);

    world.addBody(body);
    return body;
  }

  // links ball
  attachBall(ball: CANNON.Body) {
    this.ball = ball;
  }

  // detects scoring
  private checkBall() {
    if (this.hasScored || !this.ball) return;

    const dist = this.ball.position.distanceTo(this.bottomBody.position);

    if (dist < 0.9) {
      this.hasScored = true;

      // makes cone glow blue
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
