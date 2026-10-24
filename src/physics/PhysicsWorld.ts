import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  public world: CANNON.World;
  public groundMaterial: CANNON.Material;
  public wheelMaterial: CANNON.Material;
  public playerMaterial: CANNON.Material;
  public chassisMaterial: CANNON.Material;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 10;
    this.world.defaultContactMaterial.friction = 0.3;

    // Materials
    this.groundMaterial = new CANNON.Material('ground');
    this.wheelMaterial = new CANNON.Material('wheel');
    this.playerMaterial = new CANNON.Material('player');
    this.chassisMaterial = new CANNON.Material('chassis');

    // Contact Materials
    // Wheel <-> Ground: High friction for grip, tuned for drifting
    const wheelGroundContact = new CANNON.ContactMaterial(this.wheelMaterial, this.groundMaterial, {
      friction: 0.7,
      restitution: 0.0,
      contactEquationStiffness: 1000,
    });
    this.world.addContactMaterial(wheelGroundContact);

    // Player <-> Ground: Good traction, low bounce
    const playerGroundContact = new CANNON.ContactMaterial(this.playerMaterial, this.groundMaterial, {
      friction: 0.2,
      restitution: 0.0,
    });
    this.world.addContactMaterial(playerGroundContact);

    // Chassis <-> Ground / Obstacles
    const chassisGroundContact = new CANNON.ContactMaterial(this.chassisMaterial, this.groundMaterial, {
      friction: 0.4,
      restitution: 0.2,
    });
    this.world.addContactMaterial(chassisGroundContact);
  }

  public step(deltaTime: number): void {
    // Fixed physics step of 1/60 with maxSubSteps of 3
    const maxSubSteps = 3;
    const fixedTimeStep = 1 / 60;
    this.world.step(fixedTimeStep, Math.min(deltaTime, 0.1), maxSubSteps);
  }

  public addStaticBox(
    size: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
    material?: CANNON.Material
  ): CANNON.Body {
    const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    const body = new CANNON.Body({
      mass: 0, // static
      material: material || this.groundMaterial,
      shape: shape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
    });
    this.world.addBody(body);
    return body;
  }
}
