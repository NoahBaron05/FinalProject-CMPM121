import * as CANNON from "cannon-es";
import * as THREE from "three";

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
    onScoreCallback?: () => void,
  ) {
    this.mesh = new THREE.Group();

    this.onScoreCallback = onScoreCallback;

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

    this.createTopTrigger(physicsWorld, position);
  }

  private onScoreCallback?: () => void;

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

      const y = pos.y - this.height / 2 + wallH / 2; // align with mesh

      body.position.set(x, y, z);
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

  private createTopTrigger(world: CANNON.World, pos: THREE.Vector3) {
    // A thin ring at the top of the cup
    const triggerHeight = 0.2;
    const shape = new CANNON.Cylinder(
      this.topRadius,
      this.topRadius,
      triggerHeight,
      20,
    );

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC, // doesn't interfere physically
      collisionResponse: false, // no bounce, purely a trigger
    });

    body.addShape(shape);

    // Place the trigger at the cup's opening
    body.position.set(
      pos.x,
      pos.y + this.height / 2 - triggerHeight / 2,
      pos.z,
    );

    // Cylinder faces upward
    body.quaternion.setFromEuler(Math.PI / 2, 0, 0);

    world.addBody(body);

    // Detect ball entering
    body.addEventListener("collide", (event: CANNON.ICollisionEvent) => {
      if (event.body === this.ball && !this.hasScored) {
        this.hasScored = true;
        this.onScore();
      }
    });
  }

  // links ball
  attachBall(ball: CANNON.Body) {
    this.ball = ball;
  }

  onScore() {
    console.log("Ball scored!");
    if (this.onScoreCallback) {
      this.onScoreCallback();
    }
  }

  update() {}
}
