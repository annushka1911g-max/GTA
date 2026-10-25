import * as THREE from 'three';

export interface MissionStep {
  description: string;
  targetPosition: THREE.Vector3;
  targetRadius: number;
  requiresVehicle?: boolean;
  timeLimit?: number; // seconds
}

export interface MissionDefinition {
  id: string;
  title: string;
  subtitle: string;
  briefing: string;
  rewardCash: number;
  startTriggerPosition: THREE.Vector3;
  triggerRadius: number;
  steps: MissionStep[];
  startWantedLevel?: number;
}

export const GAME_MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_1',
    title: 'THE FIRST DELIVERY',
    subtitle: 'Ocean Drive Syndicate Drop',
    briefing: 'Grab the sports car parked on Ocean Drive and deliver the package to the Downtown warehouse before the clock runs out!',
    rewardCash: 3000,
    startTriggerPosition: new THREE.Vector3(120, 0.5, 30),
    triggerRadius: 4.5,
    steps: [
      {
        description: 'Get in a vehicle and deliver the package to Downtown',
        targetPosition: new THREE.Vector3(-80, 0.5, 40),
        targetRadius: 6.0,
        requiresVehicle: true,
        timeLimit: 90,
      },
    ],
  },
  {
    id: 'mission_2',
    title: 'COASTAL GETAWAY',
    subtitle: 'High-Speed Police Evasion',
    briefing: 'The Sun Bay PD intercepted your frequency! Outrun the patrol cruisers, lose your wanted heat, and stash the car at the safehouse.',
    rewardCash: 5000,
    startTriggerPosition: new THREE.Vector3(30, 0.5, -40),
    triggerRadius: 4.5,
    startWantedLevel: 2,
    steps: [
      {
        description: 'Lose your wanted level and reach the West Safehouse',
        targetPosition: new THREE.Vector3(-140, 0.5, -90),
        targetRadius: 7.0,
        requiresVehicle: true,
        timeLimit: 120,
      },
    ],
  },
  {
    id: 'mission_3',
    title: 'NIGHT SHIFT',
    subtitle: 'Multi-District Contraband Run',
    briefing: 'Hit 3 pickup drop spots across the city landmarks—Ocean Beach, Commercial Promenade, and the Marina Docks.',
    rewardCash: 7500,
    startTriggerPosition: new THREE.Vector3(80, 0.5, -120),
    triggerRadius: 4.5,
    steps: [
      {
        description: 'Collect Drop 1: Ocean Beach Boardwalk',
        targetPosition: new THREE.Vector3(180, 0.5, -60),
        targetRadius: 5.0,
        timeLimit: 60,
      },
      {
        description: 'Collect Drop 2: Central Plaza Fountain',
        targetPosition: new THREE.Vector3(-20, 0.5, 80),
        targetRadius: 5.0,
        timeLimit: 60,
      },
      {
        description: 'Collect Drop 3: Marina Docks Warehouse',
        targetPosition: new THREE.Vector3(-160, 0.5, 120),
        targetRadius: 5.0,
        timeLimit: 60,
      },
    ],
  },
];
