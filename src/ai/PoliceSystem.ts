import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AudioManager } from '../audio/AudioManager';
import { Player, PlayerState } from '../entities/Player';
import { Vehicle } from '../entities/Vehicle';
import { City } from '../world/City';

export interface PoliceOfficer {
  mesh: THREE.Group;
  health: number;
  position: THREE.Vector3;
  targetPos: THREE.Vector3;
  isDead: boolean;
  despawnTimer: number;
}

export interface PoliceCar {
  vehicle: Vehicle;
  sirenLight: THREE.PointLight;
  lightClock: number;
}

export class PoliceSystem {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private audio: AudioManager;
  private city: City;

  public wantedLevel = 0;
  public cooldownTimer = 0;
  public isCoolingDown = false;

  public policeCars: PoliceCar[] = [];
  public policeOfficers: PoliceOfficer[] = [];

  private spawnCooldown = 0;
  private arrestTimer = 0;

  private onPlayerBustedCallback?: () => void;
  private onPlayerWastedCallback?: () => void;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, audio: AudioManager, city: City) {
    this.scene = scene;
    this.physics = physics;
    this.audio = audio;
    this.city = city;
  }

  public setCallbacks(onBusted: () => void, onWasted: () => void): void {
    this.onPlayerBustedCallback = onBusted;
    this.onPlayerWastedCallback = onWasted;
  }

  public addCrime(starsToAdd: number): void {
    this.wantedLevel = Math.max(1, Math.min(5, this.wantedLevel + starsToAdd));
    this.cooldownTimer = 22.0; // 22s escape cooldown
    this.isCoolingDown = false;
  }

  public clearWanted(): void {
    this.wantedLevel = 0;
    this.cooldownTimer = 0;
    this.isCoolingDown = false;
    this.cleanupUnits();
  }

  public update(deltaTime: number, player: Player): void {
    const playerPos = player.getPosition();

    // Check player health for WASTED condition
    if (player.health <= 0) {
      if (this.onPlayerWastedCallback) {
        this.onPlayerWastedCallback();
      }
      return;
    }

    if (this.wantedLevel > 0) {
      // Cooldown logic when distant from police
      const closestPoliceDist = this.getClosestPoliceDistance(playerPos);
      if (closestPoliceDist > 55) {
        this.isCoolingDown = true;
        this.cooldownTimer -= deltaTime;
        if (this.cooldownTimer <= 0) {
          this.wantedLevel--;
          if (this.wantedLevel > 0) {
            this.cooldownTimer = 15.0;
          } else {
            this.clearWanted();
          }
        }
      } else {
        this.isCoolingDown = false;
        this.cooldownTimer = 20.0;
      }

      // Police dispatching
      this.spawnCooldown -= deltaTime;
      const desiredCars = Math.min(this.wantedLevel, 3);
      if (this.policeCars.length < desiredCars && this.spawnCooldown <= 0) {
        this.spawnPoliceCar(playerPos);
        this.spawnCooldown = 4.0;
      }

      // Update police car pursuits
      this.updatePoliceCars(deltaTime, playerPos, player);

      // Check arrest condition (BUSTED)
      if (player.state === PlayerState.ON_FOOT) {
        if (closestPoliceDist < 3.2 && player.body.velocity.length() < 1.5) {
          this.arrestTimer += deltaTime;
          if (this.arrestTimer > 2.0) {
            if (this.onPlayerBustedCallback) {
              this.onPlayerBustedCallback();
            }
          }
        } else {
          this.arrestTimer = Math.max(0, this.arrestTimer - deltaTime);
        }
      }
    } else {
      if (this.policeCars.length > 0 || this.policeOfficers.length > 0) {
        this.cleanupUnits();
      }
    }
  }

  private spawnPoliceCar(playerPos: THREE.Vector3): void {
    // Spawn behind or ahead along road network (50m - 90m)
    const validRoads = this.city.roads.filter((r) => {
      const mid = new THREE.Vector3((r.x1 + r.x2) / 2, 0.5, (r.z1 + r.z2) / 2);
      const d = mid.distanceTo(playerPos);
      return d >= 45 && d <= 95;
    });

    if (validRoads.length === 0) return;
    const road = validRoads[Math.floor(Math.random() * validRoads.length)];

    const spawnPos = new THREE.Vector3(road.x1, 0.5, road.z1);

    const vehicle = new Vehicle(
      this.scene,
      this.physics,
      this.audio,
      {
        type: 'police',
        name: 'VCPD INTERCEPTOR',
        bodyColor: 0x15803d,
        mass: 1650,
        engineForce: 3800 + this.wantedLevel * 200,
        maxSteer: 0.52,
        brakeForce: 130,
      },
      spawnPos,
      0
    );

    // Flashing emergency siren beacon
    const sirenLight = new THREE.PointLight(0xef4444, 4, 25);
    sirenLight.position.set(0, 1.2, 0);
    vehicle.mesh.add(sirenLight);

    this.policeCars.push({
      vehicle,
      sirenLight,
      lightClock: 0,
    });
  }

  private updatePoliceCars(deltaTime: number, playerPos: THREE.Vector3, player: Player): void {
    for (let i = this.policeCars.length - 1; i >= 0; i--) {
      const pc = this.policeCars[i];
      const car = pc.vehicle;

      // Despawn if too far away (> 160m)
      const dist = car.mesh.position.distanceTo(playerPos);
      if (dist > 180) {
        car.destroy(this.scene, this.physics);
        this.policeCars.splice(i, 1);
        continue;
      }

      // Siren beacon flash alternation (Red <-> Blue)
      pc.lightClock += deltaTime * 8;
      const isRed = Math.sin(pc.lightClock) > 0;
      pc.sirenLight.color.setHex(isRed ? 0xef4444 : 0x3b82f6);

      // AI Pursuit navigation towards player
      const toPlayer = new THREE.Vector3().subVectors(playerPos, car.mesh.position);
      toPlayer.y = 0;
      toPlayer.normalize();

      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.mesh.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(car.mesh.quaternion);

      const steerDot = right.dot(toPlayer);
      const forwardDot = forward.dot(toPlayer);

      let steer = Math.max(-1, Math.min(1, steerDot * 2.2));
      let throttle = 0.85;
      let handbrake = false;

      // Ramming / intercept tactics
      if (forwardDot < -0.3 && dist < 15) {
        // Reverse if player is behind
        throttle = -0.7;
        steer = -steer;
      } else if (dist < 8) {
        // Ram into player
        throttle = 1.0;
        if (Math.abs(steer) > 0.4) {
          handbrake = true; // Drift whip around corners
        }

        // Deal vehicle collision damage to player on foot
        if (player.state === PlayerState.ON_FOOT && dist < 3.2 && car.getSpeedMph() > 10) {
          player.health = Math.max(0, player.health - deltaTime * 35);
        }
      }

      car.setInputs(throttle, steer, handbrake);
      car.update(deltaTime);
    }
  }

  public getClosestPoliceDistance(playerPos: THREE.Vector3): number {
    let min = Infinity;
    for (const pc of this.policeCars) {
      const d = pc.vehicle.mesh.position.distanceTo(playerPos);
      if (d < min) min = d;
    }
    return min;
  }

  public cleanupUnits(): void {
    for (const pc of this.policeCars) {
      pc.vehicle.destroy(this.scene, this.physics);
    }
    this.policeCars = [];
    this.policeOfficers = [];
  }
}
