import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AudioManager } from '../audio/AudioManager';
import { Vehicle, VehicleConfig } from '../entities/Vehicle';
import { City, RoadSegment } from '../world/City';

export interface TrafficVehicle {
  vehicle: Vehicle;
  currentRoad: RoadSegment;
  targetPos: THREE.Vector3;
  laneOffset: number;
  direction: 1 | -1;
  isDespawning: boolean;
}

export class TrafficManager {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private audio: AudioManager;
  private city: City;

  public trafficList: TrafficVehicle[] = [];
  private maxTraffic = 8;
  private spawnCooldown = 0;

  private vehicleConfigs: VehicleConfig[] = [
    {
      type: 'taxi',
      name: 'KAUFMAN CAB',
      bodyColor: 0xfacc15,
      mass: 1450,
      engineForce: 3000,
      maxSteer: 0.46,
      brakeForce: 100,
    },
    {
      type: 'cruiser',
      name: 'GLENDALE SEDAN',
      bodyColor: 0x94a3b8,
      mass: 1500,
      engineForce: 2900,
      maxSteer: 0.45,
      brakeForce: 95,
    },
    {
      type: 'cheetah',
      name: 'STALLION SPORT',
      bodyColor: 0xef4444,
      mass: 1350,
      engineForce: 3400,
      maxSteer: 0.48,
      brakeForce: 110,
    },
    {
      type: 'infernus',
      name: 'PHOENIX GT',
      bodyColor: 0x3b82f6,
      mass: 1300,
      engineForce: 3600,
      maxSteer: 0.5,
      brakeForce: 115,
    },
  ];

  constructor(scene: THREE.Scene, physics: PhysicsWorld, audio: AudioManager, city: City) {
    this.scene = scene;
    this.physics = physics;
    this.audio = audio;
    this.city = city;
  }

  public update(deltaTime: number, playerPos: THREE.Vector3, playerVehicle: Vehicle | null): void {
    this.spawnCooldown -= deltaTime;

    // Spawn traffic in range (40m - 120m)
    if (this.trafficList.length < this.maxTraffic && this.spawnCooldown <= 0) {
      this.spawnTrafficCar(playerPos);
      this.spawnCooldown = 2.5;
    }

    // Update traffic behaviors
    for (let i = this.trafficList.length - 1; i >= 0; i--) {
      const item = this.trafficList[i];
      const car = item.vehicle;

      // If player hijacked this car, remove from traffic AI control
      if (car.isPlayerDriving || car === playerVehicle) {
        this.trafficList.splice(i, 1);
        continue;
      }

      // Despawn if too far away
      const distToPlayer = car.mesh.position.distanceTo(playerPos);
      if (distToPlayer > 180) {
        car.destroy(this.scene, this.physics);
        this.trafficList.splice(i, 1);
        continue;
      }

      // Traffic driving logic
      this.driveTrafficCar(item, deltaTime, playerPos);
    }
  }

  private spawnTrafficCar(playerPos: THREE.Vector3): void {
    if (this.city.roads.length === 0) return;

    // Find road segment at suitable distance
    const eligibleRoads = this.city.roads.filter((r) => {
      const midX = (r.x1 + r.x2) / 2;
      const midZ = (r.z1 + r.z2) / 2;
      const d = Math.hypot(midX - playerPos.x, midZ - playerPos.z);
      return d >= 45 && d <= 120;
    });

    if (eligibleRoads.length === 0) return;

    const road = eligibleRoads[Math.floor(Math.random() * eligibleRoads.length)];
    const config = this.vehicleConfigs[Math.floor(Math.random() * this.vehicleConfigs.length)];

    // Direction along road
    const dir = Math.random() > 0.5 ? 1 : -1;
    const laneOffset = dir * (road.width / 4);

    // Calculate spawn position and rotation
    const isHorizontal = Math.abs(road.z1 - road.z2) < 2;
    let spawnX: number;
    let spawnZ: number;
    let rotY: number;

    if (isHorizontal) {
      spawnX = dir === 1 ? Math.min(road.x1, road.x2) + 5 : Math.max(road.x1, road.x2) - 5;
      spawnZ = road.z1 + laneOffset;
      rotY = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      spawnX = road.x1 + laneOffset;
      spawnZ = dir === 1 ? Math.min(road.z1, road.z2) + 5 : Math.max(road.z1, road.z2) - 5;
      rotY = dir === 1 ? 0 : Math.PI;
    }

    const vehicle = new Vehicle(
      this.scene,
      this.physics,
      this.audio,
      config,
      new THREE.Vector3(spawnX, 0.5, spawnZ),
      rotY
    );

    const targetPos = new THREE.Vector3(
      isHorizontal ? (dir === 1 ? Math.max(road.x1, road.x2) : Math.min(road.x1, road.x2)) : spawnX,
      0.5,
      isHorizontal ? spawnZ : dir === 1 ? Math.max(road.z1, road.z2) : Math.min(road.z1, road.z2)
    );

    this.trafficList.push({
      vehicle,
      currentRoad: road,
      targetPos,
      laneOffset,
      direction: dir,
      isDespawning: false,
    });
  }

  private driveTrafficCar(item: TrafficVehicle, deltaTime: number, playerPos: THREE.Vector3): void {
    const car = item.vehicle;
    const pos = car.mesh.position;
    const distToTarget = pos.distanceTo(item.targetPos);

    if (distToTarget < 6.0) {
      // Pick next road or reverse direction
      item.direction = item.direction === 1 ? -1 : 1;
      item.laneOffset = item.direction * (item.currentRoad.width / 4);
      const isHorizontal = Math.abs(item.currentRoad.z1 - item.currentRoad.z2) < 2;
      item.targetPos.set(
        isHorizontal
          ? item.direction === 1
            ? Math.max(item.currentRoad.x1, item.currentRoad.x2)
            : Math.min(item.currentRoad.x1, item.currentRoad.x2)
          : item.currentRoad.x1 + item.laneOffset,
        0.5,
        isHorizontal
          ? item.currentRoad.z1 + item.laneOffset
          : item.direction === 1
          ? Math.max(item.currentRoad.z1, item.currentRoad.z2)
          : Math.min(item.currentRoad.z1, item.currentRoad.z2)
      );
    }

    // Steering towards target
    const toTarget = new THREE.Vector3().subVectors(item.targetPos, pos);
    toTarget.y = 0;
    toTarget.normalize();

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.mesh.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(car.mesh.quaternion);

    const steerDot = right.dot(toTarget);
    let steerInput = Math.max(-1, Math.min(1, steerDot * 2.0));

    // Collision avoidance: check if player or another vehicle is directly ahead
    let obstacleAhead = false;
    const aheadPos = pos.clone().addScaledVector(forward, 8.0);

    if (aheadPos.distanceTo(playerPos) < 6.0) {
      obstacleAhead = true;
    }

    for (const other of this.trafficList) {
      if (other !== item) {
        if (aheadPos.distanceTo(other.vehicle.mesh.position) < 7.0) {
          obstacleAhead = true;
          break;
        }
      }
    }

    let throttle = 0.55; // cruising speed (~30 MPH)
    let handbrake = false;

    if (obstacleAhead) {
      throttle = -0.5; // Brake to stop
      handbrake = true;
    }

    car.setInputs(throttle, steerInput, handbrake);
    car.update(deltaTime);
  }

  public getAllVehicles(): Vehicle[] {
    return this.trafficList.map((t) => t.vehicle);
  }
}
