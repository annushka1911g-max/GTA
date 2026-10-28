import * as THREE from 'three';
import { ExplosionSystem } from './ExplosionSystem';
import { AudioManager } from '../audio/AudioManager';

export interface Projectile {
  type: 'rocket' | 'grenade' | 'bullet';
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  damage: number;
  blastRadius: number;
  smokeTimer: number;
}

export class ProjectileSystem {
  private scene: THREE.Scene;
  private explosionSystem: ExplosionSystem;
  private audio: AudioManager;

  private projectiles: Projectile[] = [];

  constructor(scene: THREE.Scene, explosionSystem: ExplosionSystem, audio: AudioManager) {
    this.scene = scene;
    this.explosionSystem = explosionSystem;
    this.audio = audio;
  }

  /**
   * Spawns an RPG Rocket
   */
  public launchRocket(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const group = new THREE.Group();

    // Rocket body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
    const warheadMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });

    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), bodyMat);
    cylinder.rotation.x = Math.PI / 2;
    group.add(cylinder);

    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), warheadMat);
    warhead.position.z = 0.45;
    warhead.rotation.x = Math.PI / 2;
    group.add(warhead);

    // Glowing rocket exhaust thruster light
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), flameMat);
    flame.position.z = -0.45;
    flame.rotation.x = -Math.PI / 2;
    group.add(flame);

    const thrustLight = new THREE.PointLight(0xff6600, 4, 8);
    thrustLight.position.z = -0.4;
    group.add(thrustLight);

    group.position.copy(origin);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
    this.scene.add(group);

    const speed = 45; // Fast ballistic flight
    this.projectiles.push({
      type: 'rocket',
      mesh: group,
      position: origin.clone(),
      velocity: direction.clone().normalize().multiplyScalar(speed),
      age: 0,
      maxAge: 4.0,
      damage: 150,
      blastRadius: 16,
      smokeTimer: 0,
    });
  }

  /**
   * Throws a pineapple grenade
   */
  public throwGrenade(origin: THREE.Vector3, forwardDir: THREE.Vector3): void {
    const group = new THREE.Group();

    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8, metalness: 0.2 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), grenadeMat);
    group.add(sphere);

    group.position.copy(origin);
    this.scene.add(group);

    const throwVel = forwardDir.clone().normalize().multiplyScalar(18);
    throwVel.y += 6.5; // Upward arc

    this.projectiles.push({
      type: 'grenade',
      mesh: group,
      position: origin.clone(),
      velocity: throwVel,
      age: 0,
      maxAge: 2.2, // 2.2 second fuse
      damage: 120,
      blastRadius: 12,
      smokeTimer: 0,
    });
  }

  public update(deltaTime: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += deltaTime;

      if (p.type === 'rocket') {
        // Linear rocket flight
        p.position.addScaledVector(p.velocity, deltaTime);
        p.mesh.position.copy(p.position);

        // Ground / Building impact check
        if (p.position.y <= 0.2 || p.age >= p.maxAge) {
          this.detonate(p);
          this.projectiles.splice(i, 1);
          continue;
        }

        // Raycast check ahead for obstacles or vehicles
        const rayStart = p.position.clone();
        const rayDir = p.velocity.clone().normalize();
        const rayStep = p.velocity.length() * deltaTime;

        // Check if hit below ground or near buildings
        if (p.position.y < 0.2) {
          this.detonate(p);
          this.projectiles.splice(i, 1);
          continue;
        }
      } else if (p.type === 'grenade') {
        // Gravity
        p.velocity.y -= 19.6 * deltaTime;
        p.position.addScaledVector(p.velocity, deltaTime);

        // Ground bounce
        if (p.position.y <= 0.15) {
          p.position.y = 0.15;
          p.velocity.y = -p.velocity.y * 0.45; // Dampened bounce
          p.velocity.x *= 0.82;
          p.velocity.z *= 0.82;
        }

        p.mesh.position.copy(p.position);
        p.mesh.rotation.x += deltaTime * 8;
        p.mesh.rotation.y += deltaTime * 5;

        // Fuse detonation
        if (p.age >= p.maxAge) {
          this.detonate(p);
          this.projectiles.splice(i, 1);
          continue;
        }
      }
    }
  }

  private detonate(p: Projectile): void {
    this.scene.remove(p.mesh);
    this.explosionSystem.createExplosion(p.position, p.blastRadius, 3500, p.damage);
  }
}
