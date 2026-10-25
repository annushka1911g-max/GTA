import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AudioManager } from '../audio/AudioManager';
import { Vehicle } from './Vehicle';

export enum PlayerState {
  ON_FOOT = 'ON_FOOT',
  IN_VEHICLE = 'IN_VEHICLE',
}

export type WeaponType = 'fists' | 'bat' | 'pistol';

export class Player {
  public mesh: THREE.Group;
  public body: CANNON.Body;
  public state: PlayerState = PlayerState.ON_FOOT;
  public currentVehicle: Vehicle | null = null;

  // Rig hierarchy for Tommy Vercetti
  private pelvis: THREE.Group;
  private torso: THREE.Group;
  private head: THREE.Group;

  // Arms with separate upper & forearm joints
  private leftUpperArm: THREE.Group;
  private leftForearm: THREE.Group;
  private rightUpperArm: THREE.Group;
  private rightForearm: THREE.Group;
  private rightHandWeaponMount: THREE.Group;

  // Legs with separate thigh & calf/foot joints
  private leftThigh: THREE.Group;
  private leftCalf: THREE.Group;
  private rightThigh: THREE.Group;
  private rightCalf: THREE.Group;

  // Weapon visual 3D attachments
  private batMesh: THREE.Group;
  private pistolMesh: THREE.Group;
  private muzzleFlash: THREE.PointLight;
  public currentWeapon: WeaponType = 'fists';
  public pistolAmmo = 60;

  // Input states
  public moveForward = 0;
  public moveRight = 0;
  public isSprinting = false;
  public isJumping = false;
  public isAiming = false;

  // Combat Combo
  public isAttacking = false;
  private comboStep = 0;
  private attackTimer = 0;
  private comboResetTimer = 0;

  // Camera settings
  public camera: THREE.PerspectiveCamera;
  public cameraPivot: THREE.Object3D;
  public cameraYaw = 0;
  public cameraPitch = 0.22;
  public cameraDistance = 4.2;
  private cameraModes = [3.0, 4.5, 7.0];
  private cameraModeIndex = 1;

  // Animation clocks
  private animClock = 0;
  private footstepClock = 0;
  private smoothVelocity = new THREE.Vector3();

  // Physics & Audio refs
  private physics: PhysicsWorld;
  private audio: AudioManager;
  private isGrounded = true;

  // Stats
  public health = 100;
  public armor = 100;
  public stamina = 100;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, audio: AudioManager, camera: THREE.PerspectiveCamera) {
    this.physics = physics;
    this.audio = audio;
    this.camera = camera;

    // 1. Root Mesh
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    // 2. Build Tommy Vercetti anatomical rig
    const rig = this.buildTommyVercettiRig();
    this.pelvis = rig.pelvis;
    this.torso = rig.torso;
    this.head = rig.head;
    this.leftUpperArm = rig.leftUpperArm;
    this.leftForearm = rig.leftForearm;
    this.rightUpperArm = rig.rightUpperArm;
    this.rightForearm = rig.rightForearm;
    this.rightHandWeaponMount = rig.rightHandWeaponMount;
    this.leftThigh = rig.leftThigh;
    this.leftCalf = rig.leftCalf;
    this.rightThigh = rig.rightThigh;
    this.rightCalf = rig.rightCalf;
    this.batMesh = rig.batMesh;
    this.pistolMesh = rig.pistolMesh;
    this.muzzleFlash = rig.muzzleFlash;

    // 3. Physics Body with upright damping
    const radius = 0.42;
    const height = 1.8;
    const shape = new CANNON.Cylinder(radius, radius, height - radius * 2, 8);
    this.body = new CANNON.Body({
      mass: 80,
      material: physics.playerMaterial,
      position: new CANNON.Vec3(0, 3, 5),
      fixedRotation: true,
    });
    this.body.addShape(shape);
    this.body.linearDamping = 0.88;
    physics.world.addBody(this.body);

    // 4. Camera Pivot
    this.cameraPivot = new THREE.Object3D();
    scene.add(this.cameraPivot);
  }

  /**
   * Constructs Tommy Vercetti's signature model:
   * Turquoise Hawaiian floral shirt, blue jeans, white sneakers, slick dark hair, gold chain.
   */
  private buildTommyVercettiRig() {
    const root = this.mesh;

    // Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.65 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.8 }); // Dark slicked hair
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 }); // Gold chain

    // Turquoise Hawaiian floral pattern texture
    const shirtTexture = this.createHawaiianShirtTexture();
    const shirtMat = new THREE.MeshStandardMaterial({
      map: shirtTexture,
      roughness: 0.6,
    });

    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.75 }); // Denim blue jeans
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }); // White 80s sneakers

    // Pelvis (root of skeleton)
    const pelvis = new THREE.Group();
    pelvis.position.y = 0.95;
    root.add(pelvis);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.28), jeansMat);
    pelvisMesh.castShadow = true;
    pelvis.add(pelvisMesh);

    // Torso (Cyan Hawaiian Shirt)
    const torso = new THREE.Group();
    torso.position.y = 0.12;
    pelvis.add(torso);

    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.65, 0.32), shirtMat);
    chestMesh.position.y = 0.32;
    chestMesh.castShadow = true;
    torso.add(chestMesh);

    // Open Collar & Chest Skin V-Neck
    const vNeck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.05), skinMat);
    vNeck.position.set(0, 0.5, 0.15);
    torso.add(vNeck);

    // Gold Chain Necklace
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12), goldMat);
    chain.rotation.x = Math.PI / 3;
    chain.position.set(0, 0.54, 0.12);
    torso.add(chain);

    // Head & Hair
    const head = new THREE.Group();
    head.position.set(0, 0.68, 0);
    torso.add(head);

    const faceMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.32), skinMat);
    faceMesh.castShadow = true;
    head.add(faceMesh);

    // Slick 80s Dark Hair
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.36), hairMat);
    hair.position.set(0, 0.16, -0.02);
    head.add(hair);

    const sideburnL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.12), hairMat);
    sideburnL.position.set(-0.17, 0.04, 0);
    const sideburnR = sideburnL.clone();
    sideburnR.position.x = 0.17;
    head.add(sideburnL, sideburnR);

    // --- ARMS ---
    // Left Arm (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand)
    const leftUpperArm = new THREE.Group();
    leftUpperArm.position.set(-0.36, 0.58, 0);
    torso.add(leftUpperArm);

    const leftBicep = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.18), shirtMat);
    leftBicep.position.y = -0.16;
    leftBicep.castShadow = true;
    leftUpperArm.add(leftBicep);

    const leftForearm = new THREE.Group();
    leftForearm.position.set(0, -0.32, 0);
    leftUpperArm.add(leftForearm);

    const leftArmLower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), skinMat);
    leftArmLower.position.y = -0.16;
    leftArmLower.castShadow = true;
    leftForearm.add(leftArmLower);

    // Right Arm (Shoulder -> Upper Arm -> Forearm -> Weapon Mount)
    const rightUpperArm = new THREE.Group();
    rightUpperArm.position.set(0.36, 0.58, 0);
    torso.add(rightUpperArm);

    const rightBicep = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.18), shirtMat);
    rightBicep.position.y = -0.16;
    rightBicep.castShadow = true;
    rightUpperArm.add(rightBicep);

    const rightForearm = new THREE.Group();
    rightForearm.position.set(0, -0.32, 0);
    rightUpperArm.add(rightForearm);

    const rightArmLower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), skinMat);
    rightArmLower.position.y = -0.16;
    rightArmLower.castShadow = true;
    rightForearm.add(rightArmLower);

    // Right Hand Weapon Mount
    const rightHandWeaponMount = new THREE.Group();
    rightHandWeaponMount.position.set(0, -0.34, 0.05);
    rightForearm.add(rightHandWeaponMount);

    // Weapon 3D Models:
    // 1. Baseball Bat
    const batMesh = this.createBatMesh();
    batMesh.visible = false;
    rightHandWeaponMount.add(batMesh);

    // 2. Colt .45 Pistol
    const pistolMesh = this.createPistolMesh();
    pistolMesh.visible = false;
    rightHandWeaponMount.add(pistolMesh);

    // Muzzle flash point light
    const muzzleFlash = new THREE.PointLight(0xffedd5, 0, 10);
    muzzleFlash.position.set(0, 0, 0.4);
    rightHandWeaponMount.add(muzzleFlash);

    // --- LEGS ---
    // Left Leg (Hip -> Thigh -> Knee -> Calf -> Sneaker)
    const leftThigh = new THREE.Group();
    leftThigh.position.set(-0.16, -0.05, 0);
    pelvis.add(leftThigh);

    const leftThighMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), jeansMat);
    leftThighMesh.position.y = -0.21;
    leftThighMesh.castShadow = true;
    leftThigh.add(leftThighMesh);

    const leftCalf = new THREE.Group();
    leftCalf.position.set(0, -0.42, 0);
    leftThigh.add(leftCalf);

    const leftCalfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.2), jeansMat);
    leftCalfMesh.position.y = -0.19;
    leftCalfMesh.castShadow = true;
    leftCalf.add(leftCalfMesh);

    const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.32), shoeMat);
    leftFoot.position.set(0, -0.42, 0.06);
    leftFoot.castShadow = true;
    leftCalf.add(leftFoot);

    // Right Leg
    const rightThigh = new THREE.Group();
    rightThigh.position.set(0.16, -0.05, 0);
    pelvis.add(rightThigh);

    const rightThighMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), jeansMat);
    rightThighMesh.position.y = -0.21;
    rightThighMesh.castShadow = true;
    rightThigh.add(rightThighMesh);

    const rightCalf = new THREE.Group();
    rightCalf.position.set(0, -0.42, 0);
    rightThigh.add(rightCalf);

    const rightCalfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.2), jeansMat);
    rightCalfMesh.position.y = -0.19;
    rightCalfMesh.castShadow = true;
    rightCalf.add(rightCalfMesh);

    const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.32), shoeMat);
    rightFoot.position.set(0, -0.42, 0.06);
    rightFoot.castShadow = true;
    rightCalf.add(rightFoot);

    return {
      pelvis,
      torso,
      head,
      leftUpperArm,
      leftForearm,
      rightUpperArm,
      rightForearm,
      rightHandWeaponMount,
      leftThigh,
      leftCalf,
      rightThigh,
      rightCalf,
      batMesh,
      pistolMesh,
      muzzleFlash,
    };
  }

  /**
   * Procedural Hawaiian Palm Shirt Texture
   */
  private createHawaiianShirtTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Turquoise / Cyan tropical base
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(0, 0, 256, 256);

    // Tropical Palm Fronds pattern
    ctx.fillStyle = '#0891b2';
    for (let y = 16; y < 256; y += 48) {
      for (let x = 16; x < 256; x += 48) {
        // Draw little palm frond leaves
        ctx.beginPath();
        ctx.ellipse(x, y, 14, 6, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(x + 10, y + 10, 12, 5, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // White floral specks
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private createBatMesh(): THREE.Group {
    const bat = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });

    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.25, 8), gripMat);
    handle.position.z = 0.1;
    bat.add(handle);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.65, 8), woodMat);
    barrel.position.z = 0.52;
    bat.add(barrel);

    bat.rotation.x = Math.PI / 3;
    return bat;
  }

  private createPistolMesh(): THREE.Group {
    const pistol = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9, roughness: 0.2 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });

    // Slide & Barrel
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), metalMat);
    slide.position.set(0, 0.06, 0.1);
    pistol.add(slide);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), gripMat);
    grip.position.set(0, -0.04, 0.02);
    grip.rotation.x = -0.25;
    pistol.add(grip);

    pistol.rotation.x = Math.PI / 6;
    return pistol;
  }

  /**
   * Weapon switching
   */
  public setWeapon(weapon: WeaponType): void {
    this.currentWeapon = weapon;
    this.batMesh.visible = weapon === 'bat';
    this.pistolMesh.visible = weapon === 'pistol';
  }

  public onAttackCallback?: (playerPos: THREE.Vector3, yaw: number, weapon: WeaponType) => void;

  /**
   * Trigger attack: Punch combo, baseball bat swing, or pistol shot!
   */
  public triggerAttack(): void {
    if (this.state !== PlayerState.ON_FOOT || this.isAttacking) return;
    this.isAttacking = true;

    if (this.currentWeapon === 'fists') {
      this.comboStep = (this.comboStep + 1) % 3;
      this.attackTimer = 0.32;
      this.comboResetTimer = 1.0;
      this.audio.playPunch(this.comboStep);
    } else if (this.currentWeapon === 'bat') {
      this.attackTimer = 0.42;
      this.audio.playBatSwing();
    } else if (this.currentWeapon === 'pistol') {
      if (this.pistolAmmo > 0) {
        this.pistolAmmo--;
        this.attackTimer = 0.25;
        this.audio.playGunshot();

        // Muzzle flash
        this.muzzleFlash.intensity = 20;
        setTimeout(() => {
          this.muzzleFlash.intensity = 0;
        }, 50);
      }
    }

    if (this.onAttackCallback) {
      this.onAttackCallback(this.mesh.position.clone(), this.mesh.rotation.y, this.currentWeapon);
    }
  }

  public takeDamage(amount: number): void {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.7);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
  }

  public respawn(pos: THREE.Vector3): void {
    if (this.state === PlayerState.IN_VEHICLE) {
      this.exitVehicle();
    }
    this.health = 100;
    this.armor = 100;
    this.stamina = 100;
    this.body.position.set(pos.x, pos.y + 1.5, pos.z);
    this.body.velocity.set(0, 0, 0);
    this.mesh.position.copy(pos);
  }

  public cycleCameraDistance(): void {
    this.cameraModeIndex = (this.cameraModeIndex + 1) % this.cameraModes.length;
    this.cameraDistance = this.cameraModes[this.cameraModeIndex];
  }

  public onMouseMove(deltaX: number, deltaY: number): void {
    const sensitivity = 0.0022;
    this.cameraYaw -= deltaX * sensitivity;
    this.cameraPitch -= deltaY * sensitivity;
    this.cameraPitch = Math.max(-0.4, Math.min(1.15, this.cameraPitch));
  }

  public enterVehicle(vehicle: Vehicle): void {
    this.state = PlayerState.IN_VEHICLE;
    this.currentVehicle = vehicle;
    vehicle.isPlayerDriving = true;

    this.mesh.visible = false;
    this.body.mass = 0;
    this.body.updateMassProperties();
    this.body.velocity.set(0, 0, 0);

    this.audio.playCarDoor();
    this.audio.startEngine();
  }

  public exitVehicle(): void {
    if (!this.currentVehicle) return;

    const exitPos = this.currentVehicle.getDriverDoorPosition();
    this.currentVehicle.isPlayerDriving = false;
    this.currentVehicle.setInputs(0, 0, false);
    this.currentVehicle.stopHonk();

    this.body.position.set(exitPos.x, exitPos.y + 0.9, exitPos.z);
    this.body.velocity.set(0, 0, 0);
    this.body.mass = 80;
    this.body.updateMassProperties();

    this.state = PlayerState.ON_FOOT;
    this.mesh.visible = true;
    this.currentVehicle = null;

    this.audio.playCarDoor();
    this.audio.stopEngine();
  }

  public update(deltaTime: number): void {
    if (this.state === PlayerState.ON_FOOT) {
      this.updateOnFoot(deltaTime);
      this.updateOnFootCamera(deltaTime);
    } else if (this.state === PlayerState.IN_VEHICLE && this.currentVehicle) {
      this.updateInVehicle(deltaTime);
      this.updateInVehicleCamera(deltaTime);
    }
  }

  private updateOnFoot(deltaTime: number): void {
    this.isGrounded = this.body.position.y <= 1.25 || Math.abs(this.body.velocity.y) < 0.2;

    const moveVector = new THREE.Vector3(this.moveRight, 0, this.moveForward);
    const isMoving = moveVector.lengthSq() > 0.01;

    let targetSpeed = 4.8; // Tommy's brisk walk
    if (this.isSprinting && this.stamina > 5) {
      targetSpeed = 9.2; // High-energy sprint
      this.stamina = Math.max(0, this.stamina - deltaTime * 14);
    } else {
      this.stamina = Math.min(100, this.stamina + deltaTime * 10);
    }

    if (isMoving) {
      moveVector.normalize();

      const cosYaw = Math.cos(this.cameraYaw);
      const sinYaw = Math.sin(this.cameraYaw);
      const worldX = moveVector.x * cosYaw - moveVector.z * sinYaw;
      const worldZ = moveVector.x * sinYaw + moveVector.z * cosYaw;

      // Smooth acceleration without sliding
      this.smoothVelocity.x = THREE.MathUtils.lerp(this.smoothVelocity.x, worldX * targetSpeed, 0.25);
      this.smoothVelocity.z = THREE.MathUtils.lerp(this.smoothVelocity.z, worldZ * targetSpeed, 0.25);

      this.body.velocity.x = this.smoothVelocity.x;
      this.body.velocity.z = this.smoothVelocity.z;

      // Rotate Tommy to movement direction or aiming direction
      const targetRotation = this.isAiming
        ? this.cameraYaw + Math.PI
        : Math.atan2(worldX, worldZ);

      // Smooth turning without popping
      let diff = targetRotation - this.mesh.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.mesh.rotation.y += diff * 0.22;

      // Footstep cadence
      this.footstepClock += deltaTime * (this.isSprinting ? 12 : 7.5);
      if (this.footstepClock >= Math.PI) {
        this.footstepClock = 0;
        if (this.isGrounded) {
          this.audio.playFootstep();
        }
      }
    } else {
      this.smoothVelocity.x *= 0.75;
      this.smoothVelocity.z *= 0.75;
      this.body.velocity.x = this.smoothVelocity.x;
      this.body.velocity.z = this.smoothVelocity.z;

      if (this.isAiming) {
        let diff = (this.cameraYaw + Math.PI) - this.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.mesh.rotation.y += diff * 0.2;
      }
    }

    // Jump
    if (this.isJumping && this.isGrounded) {
      this.body.velocity.y = 6.0;
      this.isJumping = false;
    }

    // Attack timer & combo reset
    if (this.isAttacking) {
      this.attackTimer -= deltaTime;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }

    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= deltaTime;
      if (this.comboResetTimer <= 0) {
        this.comboStep = 0;
      }
    }

    // Sync mesh position
    this.mesh.position.set(this.body.position.x, this.body.position.y - 0.9, this.body.position.z);

    // Procedural Joint Animation
    this.animateTommy(deltaTime, isMoving, targetSpeed);
  }

  /**
   * Fluid multi-joint procedural animation with Tommy Vercetti swagger
   */
  private animateTommy(deltaTime: number, isMoving: boolean, speed: number): void {
    this.animClock += deltaTime * (isMoving ? speed * 1.6 : 2.2);

    if (isMoving) {
      const stride = this.isSprinting ? 0.75 : 0.48;
      const legCycle = Math.sin(this.animClock);

      // Thighs swing opposite
      this.leftThigh.rotation.x = legCycle * stride;
      this.rightThigh.rotation.x = -legCycle * stride;

      // Realistic Knee Bend: Calves bend backwards when swinging back
      this.leftCalf.rotation.x = legCycle > 0 ? legCycle * 0.6 : 0.05;
      this.rightCalf.rotation.x = legCycle < 0 ? -legCycle * 0.6 : 0.05;

      // Tommy's Swagger Arm Swing (opposite to legs)
      if (!this.isAttacking && !this.isAiming) {
        this.leftUpperArm.rotation.x = -legCycle * stride * 0.85;
        this.rightUpperArm.rotation.x = legCycle * stride * 0.85;

        // Natural elbow flex
        this.leftForearm.rotation.x = -0.3 - Math.abs(legCycle) * 0.25;
        this.rightForearm.rotation.x = -0.3 - Math.abs(legCycle) * 0.25;
      }

      // Torso swagger roll & forward sprint lean
      this.torso.position.y = 0.12 + Math.abs(Math.sin(this.animClock * 2)) * 0.06;
      this.torso.rotation.x = this.isSprinting ? 0.18 : 0.06;
      this.torso.rotation.y = Math.sin(this.animClock) * 0.08; // Casual shoulder swagger!
    } else {
      // Idle Breathing & subtle weight shift
      const breath = Math.sin(this.animClock) * 0.03;
      this.torso.position.y = 0.12 + breath;
      this.torso.rotation.x = 0;
      this.torso.rotation.y = THREE.MathUtils.lerp(this.torso.rotation.y, 0, 0.1);

      this.leftThigh.rotation.x = THREE.MathUtils.lerp(this.leftThigh.rotation.x, 0, 0.15);
      this.rightThigh.rotation.x = THREE.MathUtils.lerp(this.rightThigh.rotation.x, 0, 0.15);
      this.leftCalf.rotation.x = THREE.MathUtils.lerp(this.leftCalf.rotation.x, 0, 0.15);
      this.rightCalf.rotation.x = THREE.MathUtils.lerp(this.rightCalf.rotation.x, 0, 0.15);

      if (!this.isAttacking && !this.isAiming) {
        this.leftUpperArm.rotation.x = THREE.MathUtils.lerp(this.leftUpperArm.rotation.x, 0.05, 0.15);
        this.rightUpperArm.rotation.x = THREE.MathUtils.lerp(this.rightUpperArm.rotation.x, 0.05, 0.15);
        this.leftForearm.rotation.x = THREE.MathUtils.lerp(this.leftForearm.rotation.x, -0.2, 0.15);
        this.rightForearm.rotation.x = THREE.MathUtils.lerp(this.rightForearm.rotation.x, -0.2, 0.15);
      }
    }

    // Aiming Stance
    if (this.isAiming) {
      this.rightUpperArm.rotation.x = -Math.PI / 2 + 0.1;
      this.rightUpperArm.rotation.y = -0.15;
      this.rightForearm.rotation.x = 0;

      this.leftUpperArm.rotation.x = -Math.PI / 2 + 0.2;
      this.leftUpperArm.rotation.y = 0.3;
      this.leftForearm.rotation.x = -0.5;
    }

    // Combat Attack Animations
    if (this.isAttacking) {
      if (this.currentWeapon === 'fists') {
        if (this.comboStep === 1) {
          // Left Jab
          this.leftUpperArm.rotation.x = -Math.PI / 2;
          this.leftForearm.rotation.x = 0.1;
        } else if (this.comboStep === 2) {
          // Right Cross
          this.rightUpperArm.rotation.x = -Math.PI / 2;
          this.rightForearm.rotation.x = 0.1;
        } else {
          // Heavy Hook
          this.rightUpperArm.rotation.x = -Math.PI / 2.2;
          this.rightUpperArm.rotation.y = -0.6;
          this.rightForearm.rotation.x = -0.5;
          this.torso.rotation.y = -0.3;
        }
      } else if (this.currentWeapon === 'bat') {
        // Full Baseball Bat Swing
        this.rightUpperArm.rotation.x = -Math.PI / 2;
        this.rightUpperArm.rotation.y = Math.sin(this.attackTimer * 12) * 1.2;
        this.torso.rotation.y = Math.sin(this.attackTimer * 12) * 0.4;
      } else if (this.currentWeapon === 'pistol') {
        // Pistol Recoil
        this.rightUpperArm.rotation.x = -Math.PI / 2 - 0.25;
        this.rightForearm.rotation.x = 0.2;
      }
    }
  }

  private updateOnFootCamera(_deltaTime: number): void {
    const targetPos = this.mesh.position.clone();
    targetPos.y += 1.4;

    this.cameraPivot.position.lerp(targetPos, 0.2);

    const dist = this.cameraDistance;
    const cx = Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const cy = Math.sin(this.cameraPitch) * dist;
    const cz = Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;

    this.camera.position.set(
      this.cameraPivot.position.x + cx,
      Math.max(0.5, this.cameraPivot.position.y + cy),
      this.cameraPivot.position.z + cz
    );

    this.camera.lookAt(this.cameraPivot.position);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 65, 0.1);
    this.camera.updateProjectionMatrix();
  }

  private updateInVehicle(_deltaTime: number): void {
    if (!this.currentVehicle) return;
    this.body.position.copy(this.currentVehicle.chassisBody.position);
  }

  private updateInVehicleCamera(_deltaTime: number): void {
    if (!this.currentVehicle) return;

    const car = this.currentVehicle;
    const carPos = car.mesh.position.clone();
    const speedMph = car.getSpeedMph();

    const targetPos = carPos.clone();
    targetPos.y += 1.15;
    this.cameraPivot.position.lerp(targetPos, 0.22);

    const behindDistance = 6.0 + speedMph * 0.02;
    const heightOffset = 2.2 + speedMph * 0.01;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.mesh.quaternion);
    const cameraIdealPos = carPos.clone().sub(forward.multiplyScalar(behindDistance));
    cameraIdealPos.y += heightOffset;

    this.camera.position.lerp(cameraIdealPos, 0.14);
    this.camera.lookAt(targetPos.clone().add(new THREE.Vector3(0, 0.35, 0)));

    const targetFov = 65 + Math.min(26, speedMph * 0.28);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.1);
    this.camera.updateProjectionMatrix();
  }

  public getPosition(): THREE.Vector3 {
    return this.state === PlayerState.ON_FOOT ? this.mesh.position : this.currentVehicle!.mesh.position;
  }
}
