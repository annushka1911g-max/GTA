import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Pedestrian, PedestrianStyle } from '../entities/Pedestrian';
import { City } from '../world/City';

export class PedestrianManager {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private city: City;

  public pedestrians: Pedestrian[] = [];
  private sidewalkNodes: THREE.Vector3[] = [];
  private maxPedestrians = 24;

  private onPedestrianDefeatedCallback?: (ped: Pedestrian, position: THREE.Vector3) => void;

  // 1980s Miami Vice Palette: Hawaiian floral shirts, pastel suits, beachwear
  private pedestrianStyles: PedestrianStyle[] = [
    { skinColor: 0xd2996d, shirtColor: 0xf472b6, pantsColor: 0xf8fafc, hairColor: 0x1f2937 }, // Pink shirt, white pants
    { skinColor: 0xe0ac69, shirtColor: 0x38bdf8, pantsColor: 0x1e293b, hairColor: 0xb45309 }, // Sky cyan, dark slacks
    { skinColor: 0x8d5524, shirtColor: 0xfde047, pantsColor: 0x047857, hairColor: 0x111827 }, // Yellow shirt, green pants
    { skinColor: 0xc68642, shirtColor: 0xfb7185, pantsColor: 0x1e3a8a, hairColor: 0x374151 }, // Coral shirt, denim
    { skinColor: 0xf1c27d, shirtColor: 0xa855f7, pantsColor: 0xf1f5f9, hairColor: 0x18181b }, // Purple pastel suit
    { skinColor: 0xe0ac69, shirtColor: 0x10b981, pantsColor: 0x64748b, hairColor: 0xd97706 }, // Mint green
    { skinColor: 0x5a3825, shirtColor: 0xffffff, pantsColor: 0xd97706, hairColor: 0x0f172a }, // Crisp white
  ];

  constructor(scene: THREE.Scene, physics: PhysicsWorld, city: City) {
    this.scene = scene;
    this.physics = physics;
    this.city = city;

    this.buildSidewalkGraph();
  }

  public setOnPedestrianDefeated(cb: (ped: Pedestrian, pos: THREE.Vector3) => void): void {
    this.onPedestrianDefeatedCallback = cb;
  }

  private buildSidewalkGraph(): void {
    // Sidewalk routes along Ocean Drive promenade (X = 135 to 165)
    for (let z = -220; z <= 220; z += 20) {
      this.sidewalkNodes.push(new THREE.Vector3(135, 0.25, z));
      this.sidewalkNodes.push(new THREE.Vector3(160, 0.1, z));
    }

    // Sidewalk perimeters around city blocks
    for (const b of this.city.buildings) {
      const halfW = b.width / 2 + 3.5;
      const halfD = b.depth / 2 + 3.5;

      this.sidewalkNodes.push(new THREE.Vector3(b.x - halfW, 0.25, b.z - halfD));
      this.sidewalkNodes.push(new THREE.Vector3(b.x + halfW, 0.25, b.z - halfD));
      this.sidewalkNodes.push(new THREE.Vector3(b.x + halfW, 0.25, b.z + halfD));
      this.sidewalkNodes.push(new THREE.Vector3(b.x - halfW, 0.25, b.z + halfD));
    }
  }

  public update(deltaTime: number, playerPos: THREE.Vector3): void {
    // 1. Maintain pool of pedestrians near player (25m - 90m)
    if (this.pedestrians.length < this.maxPedestrians) {
      this.spawnNearbyPedestrian(playerPos);
    }

    // 2. Update existing pedestrians
    for (let i = this.pedestrians.length - 1; i >= 0; i--) {
      const ped = this.pedestrians[i];

      // Assign target node if none
      if (!ped.targetNode && !ped.isDead) {
        ped.targetNode = this.findNextSidewalkNode(ped.mesh.position);
      }

      ped.update(deltaTime, playerPos);

      // Clean up dead pedestrians or distant pedestrians
      const dist = ped.mesh.position.distanceTo(playerPos);
      if ((ped.isDead && ped.despawnTimer > 20) || dist > 140) {
        ped.destroy();
        this.pedestrians.splice(i, 1);
      }
    }
  }

  private spawnNearbyPedestrian(playerPos: THREE.Vector3): void {
    if (this.sidewalkNodes.length === 0) return;

    // Pick nodes within 25m - 85m range of player
    const validNodes = this.sidewalkNodes.filter((node) => {
      const d = node.distanceTo(playerPos);
      return d >= 22 && d <= 85;
    });

    if (validNodes.length === 0) return;

    const spawnNode = validNodes[Math.floor(Math.random() * validNodes.length)];
    const style = this.pedestrianStyles[Math.floor(Math.random() * this.pedestrianStyles.length)];

    const ped = new Pedestrian(this.scene, this.physics, spawnNode, style);
    ped.targetNode = this.findNextSidewalkNode(spawnNode);
    this.pedestrians.push(ped);
  }

  private findNextSidewalkNode(currentPos: THREE.Vector3): THREE.Vector3 {
    let bestNode = currentPos;
    let candidates: THREE.Vector3[] = [];

    for (const node of this.sidewalkNodes) {
      const d = node.distanceTo(currentPos);
      if (d > 12 && d < 48) {
        candidates.push(node);
      }
    }

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)].clone();
    }

    // Fallback: random sidewalk node
    const rand = this.sidewalkNodes[Math.floor(Math.random() * this.sidewalkNodes.length)];
    return rand ? rand.clone() : currentPos.clone().add(new THREE.Vector3(15, 0, 0));
  }

  /**
   * Check attacks from player: punches, bat, gunshots
   */
  public handlePlayerAttack(
    playerPos: THREE.Vector3,
    facingYaw: number,
    weapon: 'fists' | 'bat' | 'pistol'
  ): Pedestrian | null {
    const range = weapon === 'pistol' ? 35 : weapon === 'bat' ? 2.8 : 2.2;
    const damage = weapon === 'pistol' ? 45 : weapon === 'bat' ? 30 : 18;

    const attackDir = new THREE.Vector3(Math.sin(facingYaw), 0, Math.cos(facingYaw)).normalize();

    let closestHit: Pedestrian | null = null;
    let closestDist = Infinity;

    for (const ped of this.pedestrians) {
      if (ped.isDead) continue;

      const toPed = new THREE.Vector3().subVectors(ped.mesh.position, playerPos);
      const dist = toPed.length();

      if (dist <= range) {
        toPed.normalize();
        const dot = attackDir.dot(toPed);

        // Within forward cone (> 0.4 for melee, > 0.85 for gunshot aim)
        const minDot = weapon === 'pistol' ? 0.75 : 0.35;
        if (dot >= minDot && dist < closestDist) {
          closestDist = dist;
          closestHit = ped;
        }
      }
    }

    if (closestHit) {
      const defeated = closestHit.takeDamage(damage, playerPos);
      if (defeated && this.onPedestrianDefeatedCallback) {
        this.onPedestrianDefeatedCallback(closestHit, closestHit.mesh.position.clone());
      }

      // Spook nearby pedestrians
      this.alertNearbyPedestrians(playerPos, 28);
      return closestHit;
    }

    if (weapon === 'pistol') {
      // Gunshot noise alerts nearby pedestrians even on miss
      this.alertNearbyPedestrians(playerPos, 35);
    }

    return null;
  }

  public alertNearbyPedestrians(threatPos: THREE.Vector3, radius: number): void {
    for (const ped of this.pedestrians) {
      if (!ped.isDead && ped.mesh.position.distanceTo(threatPos) < radius) {
        ped.fleeFrom(threatPos);
      }
    }
  }
}
