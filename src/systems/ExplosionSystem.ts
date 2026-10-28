import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AudioManager } from '../audio/AudioManager';

export interface ExplosionShockwave {
  position: THREE.Vector3;
  radius: number;
  maxRadius: number;
  intensity: number;
  age: number;
  mesh: THREE.Mesh;
  light: THREE.PointLight;
}

export class ExplosionSystem {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private audio: AudioManager;

  private shockwaves: ExplosionShockwave[] = [];
  private particleSystems: {
    points: THREE.Points;
    velocities: Float32Array;
    ages: Float32Array;
    maxLife: number;
  }[] = [];

  // Screen shake tracker
  public cameraShake = 0;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, audio: AudioManager) {
    this.scene = scene;
    this.physics = physics;
    this.audio = audio;
  }

  /**
   * Triggers a high-impact explosion with fireball, shockwave, sound, and physics blast
   */
  public createExplosion(
    position: THREE.Vector3,
    blastRadius: number = 14,
    force: number = 3200,
    damage: number = 100
  ): void {
    // 1. Play deep explosive blast sound
    this.audio.playExplosion();

    // 2. Add screen shake based on proximity (processed in main loop)
    this.cameraShake = Math.min(1.0, this.cameraShake + 0.65);

    // 3. Expanding fiery glowing shockwave mesh
    const waveGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xff4500, // Fiery neon orange
      transparent: true,
      opacity: 0.95,
      wireframe: false,
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.copy(position);
    this.scene.add(waveMesh);

    // Glowing explosion point light
    const blastLight = new THREE.PointLight(0xff6600, 18, blastRadius * 2.5);
    blastLight.position.copy(position);
    this.scene.add(blastLight);

    this.shockwaves.push({
      position: position.clone(),
      radius: 1.2,
      maxRadius: blastRadius,
      intensity: 1.0,
      age: 0,
      mesh: waveMesh,
      light: blastLight,
    });

    // 4. Fiery particle burst
    const count = 75;
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(count * 3);
    const velArr = new Float32Array(count * 3);
    const ageArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 0] = position.x + (Math.random() - 0.5) * 0.8;
      posArr[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.8;
      posArr[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.8;

      const speed = 12 + Math.random() * 26;
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;

      velArr[i * 3 + 0] = Math.sin(theta) * Math.cos(phi) * speed;
      velArr[i * 3 + 1] = Math.cos(theta) * speed * 0.8 + 4; // Biased upwards
      velArr[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * speed;

      ageArr[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xfacc15,
      size: 0.9,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, pMat);
    this.scene.add(points);

    this.particleSystems.push({
      points,
      velocities: velArr,
      ages: ageArr,
      maxLife: 1.2,
    });

    // 5. Physics blast impulse: apply force to all dynamic bodies within blast radius
    for (const body of this.physics.world.bodies) {
      if (body.mass <= 0) continue; // Skip static ground/buildings

      const bodyPos = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
      const dist = bodyPos.distanceTo(position);

      if (dist < blastRadius && dist > 0.1) {
        const falloff = 1 - dist / blastRadius;
        const dir = bodyPos.clone().sub(position).normalize();
        dir.y = Math.max(0.4, dir.y); // Throw upwards

        const impulse = dir.multiplyScalar(force * falloff);
        body.applyImpulse(
          new CANNON.Vec3(impulse.x, impulse.y, impulse.z),
          new CANNON.Vec3(0, 0, 0)
        );
      }
    }

    // Dispatch custom damage event for entities/vehicles/pedestrians
    window.dispatchEvent(
      new CustomEvent('explosion_blast', {
        detail: {
          position: position,
          radius: blastRadius,
          damage: damage,
        },
      })
    );
  }

  public update(deltaTime: number): void {
    // 1. Decay camera shake
    this.cameraShake = Math.max(0, this.cameraShake - deltaTime * 1.8);

    // 2. Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.age += deltaTime;
      const progress = sw.age / 0.65;

      if (progress >= 1.0) {
        this.scene.remove(sw.mesh);
        this.scene.remove(sw.light);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }

      const curRadius = THREE.MathUtils.lerp(1.2, sw.maxRadius, progress);
      sw.mesh.scale.set(curRadius, curRadius, curRadius);

      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (1 - progress) * 0.9);
      if (progress > 0.4) {
        mat.color.setHex(0x333333); // Fades into dark smoke
      }

      sw.light.intensity = (1 - progress) * 18;
    }

    // 3. Update particle fire/smoke bursts
    for (let i = this.particleSystems.length - 1; i >= 0; i--) {
      const ps = this.particleSystems[i];
      const positions = ps.points.geometry.attributes.position.array as Float32Array;
      const count = positions.length / 3;
      let allDead = true;

      for (let p = 0; p < count; p++) {
        ps.ages[p] += deltaTime;
        if (ps.ages[p] < ps.maxLife) {
          allDead = false;
          // Apply velocity
          positions[p * 3 + 0] += ps.velocities[p * 3 + 0] * deltaTime;
          positions[p * 3 + 1] += ps.velocities[p * 3 + 1] * deltaTime;
          positions[p * 3 + 2] += ps.velocities[p * 3 + 2] * deltaTime;

          // Drag and gravity
          ps.velocities[p * 3 + 0] *= 0.96;
          ps.velocities[p * 3 + 1] -= 9.8 * deltaTime * 0.6;
          ps.velocities[p * 3 + 2] *= 0.96;
        }
      }

      ps.points.geometry.attributes.position.needsUpdate = true;
      const lifeRatio = ps.ages[0] / ps.maxLife;
      const mat = ps.points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - lifeRatio);

      if (allDead) {
        this.scene.remove(ps.points);
        ps.points.geometry.dispose();
        mat.dispose();
        this.particleSystems.splice(i, 1);
      }
    }
  }
}
