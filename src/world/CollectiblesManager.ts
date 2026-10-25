import * as THREE from 'three';
import { Player } from '../entities/Player';
import { AudioManager } from '../audio/AudioManager';

export type CollectibleType = 'cash' | 'health' | 'armor' | 'ammo';

export interface CollectibleItem {
  id: string;
  type: CollectibleType;
  value: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
  collected: boolean;
  respawnTimer: number;
  initialY: number;
}

export class CollectiblesManager {
  private scene: THREE.Scene;
  private audio: AudioManager;
  public items: CollectibleItem[] = [];
  private animTime = 0;

  constructor(scene: THREE.Scene, audio: AudioManager) {
    this.scene = scene;
    this.audio = audio;

    this.spawnDefaultCollectibles();
  }

  private spawnDefaultCollectibles(): void {
    const locations: Array<{ type: CollectibleType; value: number; x: number; y: number; z: number }> = [
      // Ocean Drive Beachfront Pickups
      { type: 'cash', value: 500, x: 145, y: 0.8, z: 20 },
      { type: 'cash', value: 1000, x: 175, y: 0.8, z: -80 },
      { type: 'health', value: 50, x: 128, y: 0.8, z: -40 },
      { type: 'armor', value: 50, x: 128, y: 0.8, z: 80 },
      { type: 'ammo', value: 30, x: 165, y: 0.8, z: 120 },

      // Downtown Plazas & Alleys
      { type: 'cash', value: 750, x: -30, y: 0.8, z: 10 },
      { type: 'cash', value: 1500, x: -90, y: 0.8, z: -70 },
      { type: 'health', value: 50, x: 30, y: 0.8, z: -110 },
      { type: 'armor', value: 100, x: -110, y: 0.8, z: 40 },
      { type: 'ammo', value: 45, x: 50, y: 0.8, z: 70 },

      // Beachside & Marina hidden spots
      { type: 'cash', value: 2000, x: 260, y: 0.8, z: -140 },
      { type: 'health', value: 100, x: 230, y: 0.8, z: 160 },
      { type: 'armor', value: 100, x: -160, y: 0.8, z: -180 },
      { type: 'cash', value: 800, x: -200, y: 0.8, z: 80 },
    ];

    locations.forEach((loc, idx) => {
      this.createCollectible(`item_${idx}`, loc.type, loc.value, new THREE.Vector3(loc.x, loc.y, loc.z));
    });
  }

  public createCollectible(id: string, type: CollectibleType, value: number, pos: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(pos);

    if (type === 'cash') {
      // 3D Emerald Cash Briefcase / Money Stack
      const mat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.3,
        metalness: 0.4,
        emissive: 0x059669,
        emissiveIntensity: 0.5,
      });
      const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.35), mat);
      caseMesh.castShadow = true;
      group.add(caseMesh);

      // Gold clasp
      const clasp = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.08, 0.37),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 })
      );
      group.add(clasp);
    } else if (type === 'health') {
      // 3D Glowing Red Heart
      const heartShape = new THREE.Shape();
      const x = 0, y = 0;
      heartShape.moveTo(x + 0.25, y + 0.25);
      heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
      heartShape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
      heartShape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 0.95);
      heartShape.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
      heartShape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
      heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

      const extrudeSettings = { depth: 0.15, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
      const geo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
      geo.center();

      const mat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(0.65, 0.65, 0.65);
      group.add(mesh);
    } else if (type === 'armor') {
      // 3D Glowing Cyan Shield
      const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.7,
      });
      const shieldGeo = new THREE.CylinderGeometry(0.35, 0.1, 0.5, 6);
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.rotation.x = Math.PI / 2;
      group.add(shield);
    } else if (type === 'ammo') {
      // 3D Ammo Box
      const ammoMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
        roughness: 0.4,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.4), ammoMat);
      group.add(box);
    }

    // Glow point light
    const glowLight = new THREE.PointLight(
      type === 'cash' ? 0x10b981 : type === 'health' ? 0xef4444 : type === 'armor' ? 0x06b6d4 : 0xf59e0b,
      1.5,
      4
    );
    glowLight.position.set(0, 0.1, 0);
    group.add(glowLight);

    this.scene.add(group);

    this.items.push({
      id,
      type,
      value,
      position: pos,
      mesh: group,
      collected: false,
      respawnTimer: 0,
      initialY: pos.y,
    });
  }

  public update(deltaTime: number, player: Player, onCollect: (item: CollectibleItem) => void): void {
    this.animTime += deltaTime * 2.5;
    const playerPos = player.getPosition();

    for (const item of this.items) {
      if (item.collected) {
        item.respawnTimer -= deltaTime;
        if (item.respawnTimer <= 0) {
          item.collected = false;
          item.mesh.visible = true;
        }
        continue;
      }

      // Smooth bobbing and continuous 3D rotation
      item.mesh.rotation.y += deltaTime * 2.2;
      item.mesh.position.y = item.initialY + Math.sin(this.animTime) * 0.18;

      // Pickup proximity check
      const dist = playerPos.distanceTo(item.mesh.position);
      if (dist < 2.0) {
        item.collected = true;
        item.mesh.visible = false;
        item.respawnTimer = 45; // Respawns after 45 seconds

        this.applyPickup(item, player);
        onCollect(item);
      }
    }
  }

  private applyPickup(item: CollectibleItem, player: Player): void {
    if (item.type === 'health') {
      player.health = Math.min(100, player.health + item.value);
    } else if (item.type === 'armor') {
      player.armor = Math.min(100, player.armor + item.value);
    } else if (item.type === 'ammo') {
      player.pistolAmmo = Math.min(200, player.pistolAmmo + item.value);
    }
    // Audio trigger: brief pleasant chime
    this.playPickupSound(item.type);
  }

  private playPickupSound(_type: CollectibleType): void {
    try {
      // Audio cue through Web Audio API
      const ctx = (this.audio as unknown as { ctx?: AudioContext }).ctx;
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }
}
