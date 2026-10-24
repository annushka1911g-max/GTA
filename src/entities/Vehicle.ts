import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AudioManager } from '../audio/AudioManager';

export type VehicleType = 'infernus' | 'cheetah' | 'cruiser' | 'police' | 'taxi';

export interface VehicleConfig {
  type: VehicleType;
  name: string;
  bodyColor: number;
  secondaryColor?: number;
  mass: number;
  engineForce: number;
  maxSteer: number;
  brakeForce: number;
}

export class Vehicle {
  public mesh: THREE.Group;
  public chassisBody: CANNON.Body;
  public vehicle: CANNON.RaycastVehicle;
  public wheelMeshes: THREE.Group[] = [];
  public config: VehicleConfig;

  public headlights: THREE.SpotLight[] = [];
  public taillights: THREE.Mesh[] = [];

  private audio: AudioManager;
  public isPlayerDriving = false;

  public doorOffset = new THREE.Vector3(-1.6, 0.4, 0);

  // Smooth Input interpolation
  private targetThrottle = 0;
  private currentThrottle = 0;
  private targetSteer = 0;
  private currentSteer = 0;
  private isHandbraking = false;

  // Particle systems
  private tireSmokeParticles: THREE.Points;
  private smokePositions: Float32Array;
  private smokeCount = 50;

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    audio: AudioManager,
    config: VehicleConfig,
    position: THREE.Vector3,
    rotationY: number = 0
  ) {
    this.config = config;
    this.audio = audio;
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    // 1. Physics Chassis
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.1, 0.45, 2.3));
    this.chassisBody = new CANNON.Body({
      mass: config.mass,
      material: physics.chassisMaterial,
      position: new CANNON.Vec3(position.x, position.y + 0.9, position.z),
    });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationY);
    this.chassisBody.linearDamping = 0.12;
    this.chassisBody.angularDamping = 0.55;
    physics.world.addBody(this.chassisBody);

    // 2. RaycastVehicle
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    // 3. Wheels Setup
    const wheelOptions = {
      radius: 0.38,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 32,
      suspensionRestLength: 0.38,
      frictionSlip: 2.8,
      dampingRelaxation: 2.4,
      dampingCompression: 4.5,
      maxSuspensionForce: 100000,
      rollInfluence: 0.08, // Low roll influence prevents flipping!
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    // Front Left & Right
    wheelOptions.chassisConnectionPointLocal.set(0.95, -0.15, 1.4);
    this.vehicle.addWheel(wheelOptions);

    wheelOptions.chassisConnectionPointLocal.set(-0.95, -0.15, 1.4);
    this.vehicle.addWheel(wheelOptions);

    // Rear Left & Right
    wheelOptions.chassisConnectionPointLocal.set(0.95, -0.15, -1.35);
    this.vehicle.addWheel(wheelOptions);

    wheelOptions.chassisConnectionPointLocal.set(-0.95, -0.15, -1.35);
    this.vehicle.addWheel(wheelOptions);

    this.vehicle.addToWorld(physics.world);

    // 4. Build 3D Car Visuals
    this.buildViceCityCarVisuals(scene);

    // 5. Tire smoke particles
    this.tireSmokeParticles = this.createTireSmokeSystem(scene);
    this.smokePositions = (this.tireSmokeParticles.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
  }

  /**
   * Builds custom 1980s Vice City car bodies (Infernus, Cheetah, Ocean Cruiser, VCPD, Taxi)
   */
  private buildViceCityCarVisuals(scene: THREE.Scene): void {
    const carBody = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.config.bodyColor,
      metalness: 0.85,
      roughness: 0.25,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.75,
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      metalness: 0.3,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.1,
    });

    // Main Lower Wedge Body (Classic 80s supercar shape)
    const lowerBodyGeo = new THREE.BoxGeometry(2.1, 0.52, 4.4);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    carBody.add(lowerBody);

    // Angular 80s Sloped Nose
    const noseGeo = new THREE.BoxGeometry(2.0, 0.25, 1.1);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, -0.1, 2.3);
    nose.rotation.x = 0.15;
    carBody.add(nose);

    // Cabin / Windshield
    const cabinGeo = new THREE.BoxGeometry(1.65, 0.48, 2.2);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.48, -0.2);
    cabin.castShadow = true;
    carBody.add(cabin);

    // Roof Top
    const roofGeo = new THREE.BoxGeometry(1.6, 0.08, 1.5);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 0.74, -0.3);
    carBody.add(roof);

    // Specific 80s Vehicle Styling
    if (this.config.type === 'infernus') {
      // 80s Countach style massive rear triangular wing
      const wingGeo = new THREE.BoxGeometry(2.1, 0.08, 0.45);
      const wing = new THREE.Mesh(wingGeo, bodyMat);
      wing.position.set(0, 0.68, -2.15);
      carBody.add(wing);

      // Wing Struts
      const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.12), darkTrimMat);
      strutL.position.set(-0.7, 0.45, -2.15);
      const strutR = strutL.clone();
      strutR.position.x = 0.7;
      carBody.add(strutL, strutR);

      // Pop-up headlight rectangles
      const popupL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.4), darkTrimMat);
      popupL.position.set(0.65, 0.24, 1.8);
      const popupR = popupL.clone();
      popupR.position.x = -0.65;
      carBody.add(popupL, popupR);
    } else if (this.config.type === 'cheetah') {
      // Testarossa side strakes / aerodynamic ribs
      const strakeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const sL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.4), strakeMat);
        sL.position.set(1.06, 0.1 + i * 0.08, -0.3);
        const sR = sL.clone();
        sR.position.x = -1.06;
        carBody.add(sL, sR);
      }
    } else if (this.config.type === 'police') {
      // VCPD Police Lightbar (Single central 80s dome beacon or retro bar)
      const lightbar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 12), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      lightbar.position.set(0, 0.88, -0.2);
      carBody.add(lightbar);

      const sirenBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3), chromeMat);
      sirenBase.position.set(0, 0.8, -0.2);
      carBody.add(sirenBase);
    } else if (this.config.type === 'taxi') {
      // Kaufman Cab rooftop yellow sign
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.6 }));
      sign.position.set(0, 0.88, -0.2);
      carBody.add(sign);
    } else if (this.config.type === 'cruiser') {
      // Retro Ocean Drive Convertible: Open top + chrome bumpers!
      cabin.visible = false;
      const interiorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
      const seats = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.2), interiorMat);
      seats.position.set(0, 0.3, -0.2);
      carBody.add(seats);

      const windshieldGeo = new THREE.BoxGeometry(1.55, 0.35, 0.06);
      const windshield = new THREE.Mesh(windshieldGeo, glassMat);
      windshield.position.set(0, 0.45, 0.5);
      windshield.rotation.x = -0.3;
      carBody.add(windshield);

      const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.2, 0.15), chromeMat);
      bumperF.position.set(0, -0.05, 2.3);
      carBody.add(bumperF);
    }

    // Dual Headlights
    const spotL = new THREE.SpotLight(0xfffaed, 28, 50, Math.PI / 6, 0.3);
    spotL.position.set(0.7, 0.08, 2.2);
    const targetL = new THREE.Object3D();
    targetL.position.set(0.7, -0.5, 20);
    carBody.add(spotL, targetL);
    spotL.target = targetL;

    const spotR = new THREE.SpotLight(0xfffaed, 28, 50, Math.PI / 6, 0.3);
    spotR.position.set(-0.7, 0.08, 2.2);
    const targetR = new THREE.Object3D();
    targetR.position.set(-0.7, -0.5, 20);
    carBody.add(spotR, targetR);
    spotR.target = targetR;

    this.headlights.push(spotL, spotR);

    // Dual Red Taillights
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0x7f1d1d, emissiveIntensity: 0.5 });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), taillightMat);
    tlL.position.set(0.72, 0.12, -2.21);
    const tlR = tlL.clone();
    tlR.position.x = -0.72;
    carBody.add(tlL, tlR);
    this.taillights.push(tlL, tlR);

    this.mesh.add(carBody);

    // Build 4 Visual Wheels with 80s Deep-Dish Alloy Rims
    for (let i = 0; i < 4; i++) {
      const wheelGroup = new THREE.Group();

      const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 22);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      // Gold or Silver Deep Dish Rim
      const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.36, 12);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({
        color: this.config.type === 'infernus' ? 0xf59e0b : 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.15,
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      scene.add(wheelGroup);
      this.wheelMeshes.push(wheelGroup);
    }
  }

  private createTireSmokeSystem(scene: THREE.Scene): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.smokeCount * 3);
    for (let i = 0; i < this.smokeCount * 3; i++) {
      pos[i] = -9999;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xf1f5f9,
      size: 1.4,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
  }

  /**
   * Set inputs with progressive steering smoothing
   */
  public setInputs(throttle: number, steer: number, handbrake: boolean): void {
    this.targetThrottle = throttle;
    this.targetSteer = steer;
    this.isHandbraking = handbrake;
  }

  public update(deltaTime: number): void {
    const speedMs = this.getSpeed();
    const speedMph = speedMs * 2.23694;

    // Smooth throttle and steering interpolation (prevents twitchy steering)
    this.currentThrottle = THREE.MathUtils.lerp(this.currentThrottle, this.targetThrottle, 0.2);
    this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, this.targetSteer, 0.25);

    // Apply engine force
    const maxForce = this.config.engineForce;
    const force = this.currentThrottle * maxForce;
    this.vehicle.applyEngineForce(force, 2);
    this.vehicle.applyEngineForce(force, 3);

    // Speed-sensitive steering
    const steerFactor = Math.max(0.38, 1 - Math.abs(speedMph) / 125);
    const steerAngle = this.currentSteer * this.config.maxSteer * steerFactor;
    this.vehicle.setSteeringValue(steerAngle, 0);
    this.vehicle.setSteeringValue(steerAngle, 1);

    // Anti-Roll Stabilization: keeps car glued to the road
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
    const rollAngle = Math.asin(Math.max(-1, Math.min(1, up.x)));
    if (Math.abs(rollAngle) > 0.05) {
      const antiRollTorque = -rollAngle * 8000;
      this.chassisBody.torque.z += antiRollTorque;
    }

    // Drifting & Handbrake physics
    if (this.isHandbraking) {
      // Vice City Power-Slide: Locks rear wheels and reduces rear friction for controlled drifts!
      this.vehicle.setBrake(this.config.brakeForce * 2.8, 2);
      this.vehicle.setBrake(this.config.brakeForce * 2.8, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);

      this.vehicle.wheelInfos[2].frictionSlip = 0.9;
      this.vehicle.wheelInfos[3].frictionSlip = 0.9;
    } else if (this.currentThrottle < 0 && speedMph > 2) {
      this.vehicle.setBrake(this.config.brakeForce, 0);
      this.vehicle.setBrake(this.config.brakeForce, 1);
      this.vehicle.setBrake(this.config.brakeForce, 2);
      this.vehicle.setBrake(this.config.brakeForce, 3);

      this.vehicle.wheelInfos[2].frictionSlip = 2.8;
      this.vehicle.wheelInfos[3].frictionSlip = 2.8;
    } else {
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);

      this.vehicle.wheelInfos[2].frictionSlip = 2.8;
      this.vehicle.wheelInfos[3].frictionSlip = 2.8;
    }

    // Taillights
    const isBraking = this.isHandbraking || (this.currentThrottle < 0 && speedMph > 1);
    for (const tl of this.taillights) {
      const mat = tl.material as THREE.MeshStandardMaterial;
      if (isBraking) {
        mat.emissive.setHex(0xff007f);
        mat.emissiveIntensity = 2.5;
      } else {
        mat.emissive.setHex(0x7f1d1d);
        mat.emissiveIntensity = 0.5;
      }
    }

    // Sync mesh & wheels
    this.mesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
    this.mesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const transform = this.vehicle.wheelInfos[i].worldTransform;
      const wheelMesh = this.wheelMeshes[i];
      wheelMesh.position.copy(transform.position as unknown as THREE.Vector3);
      wheelMesh.quaternion.copy(transform.quaternion as unknown as THREE.Quaternion);
    }

    // Audio & Drift Smoke
    if (this.isPlayerDriving) {
      this.audio.updateEngine(speedMph, this.currentThrottle);

      const rearLeftSlip = this.vehicle.wheelInfos[2].skidInfo;
      const rearRightSlip = this.vehicle.wheelInfos[3].skidInfo;
      const isSlipping = this.isHandbraking || rearLeftSlip > 0.4 || rearRightSlip > 0.4;

      if (isSlipping && speedMph > 7) {
        this.audio.playTireSkid(0.85);
        this.emitTireSmoke();
      } else {
        this.audio.stopTireSkid();
      }
    }
  }

  private emitTireSmoke(): void {
    if (this.wheelMeshes.length < 4) return;
    const wheel2 = this.wheelMeshes[2].position;
    const wheel3 = this.wheelMeshes[3].position;

    const idx = (Math.floor(Math.random() * this.smokeCount)) * 3;
    const targetWheel = Math.random() > 0.5 ? wheel2 : wheel3;

    this.smokePositions[idx] = targetWheel.x + (Math.random() - 0.5) * 0.4;
    this.smokePositions[idx + 1] = targetWheel.y + 0.1;
    this.smokePositions[idx + 2] = targetWheel.z + (Math.random() - 0.5) * 0.4;
    this.tireSmokeParticles.geometry.attributes.position.needsUpdate = true;
  }

  public getSpeed(): number {
    return this.vehicle.currentVehicleSpeedKmHour / 3.6;
  }

  public getSpeedMph(): number {
    return Math.abs(this.getSpeed() * 2.23694);
  }

  public getGear(): string {
    if (this.currentThrottle < 0 && this.getSpeedMph() > 1) return 'R';
    const mph = this.getSpeedMph();
    if (mph < 2) return 'N';
    if (mph < 22) return 'D1';
    if (mph < 46) return 'D2';
    if (mph < 70) return 'D3';
    if (mph < 94) return 'D4';
    if (mph < 118) return 'D5';
    return 'D6';
  }

  public getDriverDoorPosition(): THREE.Vector3 {
    const doorPos = this.doorOffset.clone();
    doorPos.applyQuaternion(this.mesh.quaternion);
    doorPos.add(this.mesh.position);
    return doorPos;
  }

  public honk(): void {
    if (this.config.type === 'police') {
      this.audio.toggleSiren();
    } else {
      this.audio.startHorn();
    }
  }

  public stopHonk(): void {
    if (this.config.type !== 'police') {
      this.audio.stopHorn();
    }
  }

  public destroy(scene: THREE.Scene, physics: PhysicsWorld): void {
    scene.remove(this.mesh);
    scene.remove(this.tireSmokeParticles);
    for (const wm of this.wheelMeshes) {
      scene.remove(wm);
    }
    this.vehicle.removeFromWorld(physics.world);
    physics.world.removeBody(this.chassisBody);
  }
}
