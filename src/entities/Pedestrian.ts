import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export enum PedestrianState {
  IDLE = 'IDLE',
  WALKING = 'WALKING',
  FLEEING = 'FLEEING',
  KNOCKED_OUT = 'KNOCKED_OUT',
}

export interface PedestrianStyle {
  skinColor: number;
  shirtColor: number;
  pantsColor: number;
  hairColor: number;
  hasHat?: boolean;
}

export class Pedestrian {
  public mesh: THREE.Group;
  public state: PedestrianState = PedestrianState.WALKING;
  public health = 45;
  public maxHealth = 45;

  private scene: THREE.Scene;
  private torso: THREE.Mesh;
  private head: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;

  public position: THREE.Vector3;
  public targetNode: THREE.Vector3 | null = null;
  public moveSpeed = 2.4;
  private walkClock = Math.random() * 10;
  private stateTimer = 0;
  private fleeTimer = 0;

  public isDead = false;
  public despawnTimer = 0;

  constructor(scene: THREE.Scene, _physics: PhysicsWorld, pos: THREE.Vector3, style: PedestrianStyle) {
    this.scene = scene;
    this.position = pos.clone();

    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);

    const skinMat = new THREE.MeshStandardMaterial({ color: style.skinColor, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: style.shirtColor, roughness: 0.65 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: style.pantsColor, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: style.hairColor, roughness: 0.85 });

    // 1. Pelvis & Torso
    const torsoGeo = new THREE.BoxGeometry(0.46, 0.58, 0.28);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;
    this.mesh.add(this.torso);

    // 2. Head & Hair
    this.head = new THREE.Group();
    this.head.position.set(0, 0.42, 0);
    this.torso.add(this.head);

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), hairMat);
    hairMesh.position.y = 0.12;
    this.head.add(hairMesh);

    // 3. Arms
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.32, 0.2, 0);
    this.torso.add(this.leftArm);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.14), shirtMat);
    leftArmMesh.position.y = -0.22;
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.32, 0.2, 0);
    this.torso.add(this.rightArm);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.14), shirtMat);
    rightArmMesh.position.y = -0.22;
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);

    // 4. Legs
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.14, 0.76, 0);
    this.mesh.add(this.leftLeg);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.2), pantsMat);
    leftLegMesh.position.y = -0.37;
    leftLegMesh.castShadow = true;
    this.leftLeg.add(leftLegMesh);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.14, 0.76, 0);
    this.mesh.add(this.rightLeg);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.2), pantsMat);
    rightLegMesh.position.y = -0.37;
    rightLegMesh.castShadow = true;
    this.rightLeg.add(rightLegMesh);

    scene.add(this.mesh);
  }

  public update(deltaTime: number, playerPos: THREE.Vector3): void {
    if (this.isDead) {
      this.despawnTimer += deltaTime;
      return;
    }

    this.walkClock += deltaTime * (this.state === PedestrianState.FLEEING ? 9 : 4.5);

    // React to nearby player threat
    const distToPlayer = this.mesh.position.distanceTo(playerPos);
    if (distToPlayer < 4.5 && this.state !== PedestrianState.FLEEING) {
      // Chance of fleeing if player is close or running
      if (Math.random() < 0.05) {
        this.fleeFrom(playerPos);
      }
    }

    if (this.state === PedestrianState.FLEEING) {
      this.fleeTimer -= deltaTime;
      if (this.fleeTimer <= 0) {
        this.state = PedestrianState.WALKING;
      }
      this.moveSpeed = 6.0;
    } else if (this.state === PedestrianState.WALKING) {
      this.moveSpeed = 2.4;
      this.stateTimer += deltaTime;
      if (this.stateTimer > 15) {
        this.stateTimer = 0;
        if (Math.random() < 0.2) {
          this.state = PedestrianState.IDLE;
        }
      }
    } else if (this.state === PedestrianState.IDLE) {
      this.stateTimer += deltaTime;
      if (this.stateTimer > 4) {
        this.stateTimer = 0;
        this.state = PedestrianState.WALKING;
      }
    }

    // Movement execution
    if (this.state === PedestrianState.WALKING || this.state === PedestrianState.FLEEING) {
      if (this.targetNode) {
        const dir = new THREE.Vector3().subVectors(this.targetNode, this.mesh.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist < 1.2) {
          // Reached node; trigger manager to assign new node
          this.targetNode = null;
        } else {
          dir.normalize();
          this.mesh.position.addScaledVector(dir, this.moveSpeed * deltaTime);

          const targetAngle = Math.atan2(dir.x, dir.z);
          let diff = targetAngle - this.mesh.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.mesh.rotation.y += diff * 0.15;
        }
      }

      // Animate walking limbs
      const swing = Math.sin(this.walkClock);
      this.leftLeg.rotation.x = swing * 0.5;
      this.rightLeg.rotation.x = -swing * 0.5;
      this.leftArm.rotation.x = -swing * 0.45;
      this.rightArm.rotation.x = swing * 0.45;
      this.torso.position.y = 1.05 + Math.abs(Math.sin(this.walkClock * 2)) * 0.04;
    } else {
      // Idle breathing
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.1);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.1);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.1);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, 0.1);
    }
  }

  public fleeFrom(threatPos: THREE.Vector3): void {
    if (this.isDead) return;
    this.state = PedestrianState.FLEEING;
    this.fleeTimer = 8.0;

    const fleeDir = new THREE.Vector3().subVectors(this.mesh.position, threatPos);
    fleeDir.y = 0;
    fleeDir.normalize();

    this.targetNode = this.mesh.position.clone().addScaledVector(fleeDir, 35);
  }

  public takeDamage(damage: number, attackerPos?: THREE.Vector3): boolean {
    if (this.isDead) return false;

    this.health -= damage;

    if (attackerPos) {
      this.fleeFrom(attackerPos);
    }

    if (this.health <= 0) {
      this.knockout();
      return true; // was defeated
    }
    return false;
  }

  public knockout(): void {
    this.isDead = true;
    this.state = PedestrianState.KNOCKED_OUT;
    this.health = 0;

    // Ragdoll-style fall to ground
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.2;
    this.leftArm.rotation.set(0, 0, 0.8);
    this.rightArm.rotation.set(0, 0, -0.8);
    this.leftLeg.rotation.set(0, 0, 0.2);
    this.rightLeg.rotation.set(0, 0, -0.2);
  }

  public destroy(): void {
    this.scene.remove(this.mesh);
  }
}
