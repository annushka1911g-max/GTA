import * as THREE from 'three';
import { GAME_MISSIONS, MissionDefinition } from './Missions';
import { Player, PlayerState } from '../entities/Player';
import { PoliceSystem } from '../ai/PoliceSystem';
import { AudioManager } from '../audio/AudioManager';

export class MissionManager {
  private scene: THREE.Scene;
  private audio: AudioManager;
  private police: PoliceSystem;

  public activeMission: MissionDefinition | null = null;
  public currentStepIndex = 0;
  public stepTimeRemaining = 0;
  public completedMissionIds: Set<string> = new Set();

  // 3D Visual Waypoint Beacon
  private waypointGroup: THREE.Group;
  private beaconPillar: THREE.Mesh;
  private beaconRing: THREE.Mesh;

  // 3D Mission Start Markers
  private startTriggerMeshes: Map<string, THREE.Group> = new Map();

  // UI callbacks
  private onMissionStartCallback?: (mission: MissionDefinition) => void;
  private onMissionCompleteCallback?: (mission: MissionDefinition, reward: number) => void;
  private onMissionFailedCallback?: (mission: MissionDefinition, reason: string) => void;
  private onStepChangedCallback?: (stepDesc: string) => void;

  constructor(scene: THREE.Scene, audio: AudioManager, police: PoliceSystem) {
    this.scene = scene;
    this.audio = audio;
    this.police = police;

    // Build 3D glowing waypoint beacon
    this.waypointGroup = new THREE.Group();
    this.waypointGroup.visible = false;

    // Translucent yellow beam of light
    const beamGeo = new THREE.CylinderGeometry(2.0, 2.0, 25, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.beaconPillar = new THREE.Mesh(beamGeo, beamMat);
    this.beaconPillar.position.y = 12.5;
    this.waypointGroup.add(this.beaconPillar);

    // Rotating ground ring
    const ringGeo = new THREE.RingGeometry(2.2, 2.7, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
    });
    this.beaconRing = new THREE.Mesh(ringGeo, ringMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.15;
    this.waypointGroup.add(this.beaconRing);

    scene.add(this.waypointGroup);

    this.createStartMarkers();
  }

  public setCallbacks(
    onStart: (mission: MissionDefinition) => void,
    onComplete: (mission: MissionDefinition, reward: number) => void,
    onFail: (mission: MissionDefinition, reason: string) => void,
    onStep: (stepDesc: string) => void
  ): void {
    this.onMissionStartCallback = onStart;
    this.onMissionCompleteCallback = onComplete;
    this.onMissionFailedCallback = onFail;
    this.onStepChangedCallback = onStep;
  }

  private createStartMarkers(): void {
    for (const m of GAME_MISSIONS) {
      const group = new THREE.Group();
      group.position.copy(m.startTriggerPosition);

      // Neon pink mission start disc
      const discGeo = new THREE.CylinderGeometry(m.triggerRadius * 0.6, m.triggerRadius * 0.6, 0.4, 24);
      const discMat = new THREE.MeshStandardMaterial({
        color: 0xff007f,
        emissive: 0xff007f,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.y = 0.2;
      group.add(disc);

      // Rotating neon star icon
      const starGeo = new THREE.OctahedronGeometry(0.8);
      const starMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.y = 2.0;
      group.add(star);

      this.scene.add(group);
      this.startTriggerMeshes.set(m.id, group);
    }
  }

  public startMission(missionId: string): boolean {
    const mission = GAME_MISSIONS.find((m) => m.id === missionId);
    if (!mission) return false;

    this.activeMission = mission;
    this.currentStepIndex = 0;
    const firstStep = mission.steps[0];
    this.stepTimeRemaining = firstStep.timeLimit || 0;

    // Apply initial wanted level if configured
    if (mission.startWantedLevel) {
      this.police.addCrime(mission.startWantedLevel);
    }

    this.updateWaypointVisual();

    if (this.onMissionStartCallback) {
      this.onMissionStartCallback(mission);
    }
    if (this.onStepChangedCallback) {
      this.onStepChangedCallback(firstStep.description);
    }

    return true;
  }

  public update(deltaTime: number, player: Player): void {
    const playerPos = player.getPosition();

    // 1. Animate start trigger markers
    this.startTriggerMeshes.forEach((mesh, missionId) => {
      mesh.children[1].rotation.y += deltaTime * 2.0;
      mesh.children[1].position.y = 2.0 + Math.sin(performance.now() * 0.003) * 0.25;

      // Check proximity to trigger if no active mission
      if (!this.activeMission) {
        const dist = playerPos.distanceTo(mesh.position);
        if (dist < 4.0) {
          this.startMission(missionId);
        }
      }
    });

    // 2. Active mission tracking
    if (!this.activeMission) {
      this.waypointGroup.visible = false;
      return;
    }

    const currentStep = this.activeMission.steps[this.currentStepIndex];

    // Animate active beacon
    this.waypointGroup.visible = true;
    this.beaconRing.rotation.z += deltaTime * 1.5;
    this.beaconPillar.scale.set(
      1.0 + Math.sin(performance.now() * 0.005) * 0.1,
      1.0,
      1.0 + Math.sin(performance.now() * 0.005) * 0.1
    );

    // Timer countdown
    if (this.stepTimeRemaining > 0) {
      this.stepTimeRemaining -= deltaTime;
      if (this.stepTimeRemaining <= 0) {
        this.failMission('TIME EXPIRED!');
        return;
      }
    }

    // Check step completion
    const distToTarget = playerPos.distanceTo(currentStep.targetPosition);
    if (distToTarget <= currentStep.targetRadius) {
      if (currentStep.requiresVehicle && player.state !== PlayerState.IN_VEHICLE) {
        // Player needs to be inside vehicle
        return;
      }

      // Completed this step!
      this.currentStepIndex++;
      if (this.currentStepIndex >= this.activeMission.steps.length) {
        this.completeMission();
      } else {
        const nextStep = this.activeMission.steps[this.currentStepIndex];
        this.stepTimeRemaining = nextStep.timeLimit || 0;
        this.updateWaypointVisual();
        if (this.onStepChangedCallback) {
          this.onStepChangedCallback(nextStep.description);
        }
      }
    }
  }

  private updateWaypointVisual(): void {
    if (!this.activeMission) {
      this.waypointGroup.visible = false;
      return;
    }
    const currentStep = this.activeMission.steps[this.currentStepIndex];
    this.waypointGroup.position.copy(currentStep.targetPosition);
    this.waypointGroup.visible = true;
  }

  public completeMission(): void {
    if (!this.activeMission) return;
    const mission = this.activeMission;
    this.completedMissionIds.add(mission.id);

    // Hide start marker for completed mission
    const startMesh = this.startTriggerMeshes.get(mission.id);
    if (startMesh) {
      startMesh.visible = false;
    }

    this.activeMission = null;
    this.waypointGroup.visible = false;

    if (this.onMissionCompleteCallback) {
      this.onMissionCompleteCallback(mission, mission.rewardCash);
    }
  }

  public failMission(reason: string): void {
    if (!this.activeMission) return;
    const mission = this.activeMission;
    this.activeMission = null;
    this.waypointGroup.visible = false;

    if (this.onMissionFailedCallback) {
      this.onMissionFailedCallback(mission, reason);
    }
  }

  public restartMission(): void {
    if (this.activeMission) {
      this.startMission(this.activeMission.id);
    }
  }

  public getActiveWaypointPosition(): THREE.Vector3 | null {
    if (!this.activeMission) return null;
    return this.activeMission.steps[this.currentStepIndex].targetPosition;
  }
}
