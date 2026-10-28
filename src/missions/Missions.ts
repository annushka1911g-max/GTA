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
  // ──────────────── reVC-Inspired Missions ────────────────
  {
    id: 'mission_4',
    title: 'GUARDIAN ANGELS',
    subtitle: 'Protect the Deal — Diaz\'s Coke Swap',
    briefing: 'Diaz has you providing overwatch for a dockside drug deal. Get to the rooftop vantage point, then escort the buyer vehicle to the warehouses.',
    rewardCash: 6000,
    startTriggerPosition: new THREE.Vector3(-100, 0.5, 60),
    triggerRadius: 4.5,
    steps: [
      {
        description: 'Reach the rooftop observation point',
        targetPosition: new THREE.Vector3(-60, 0.5, 100),
        targetRadius: 5.0,
        timeLimit: 45,
      },
      {
        description: 'Escort the buyer to the safehouse',
        targetPosition: new THREE.Vector3(-180, 0.5, -60),
        targetRadius: 6.0,
        requiresVehicle: true,
        timeLimit: 80,
      },
    ],
  },
  {
    id: 'mission_5',
    title: 'PHNOM PENH \'86',
    subtitle: 'Helicopter Raid on the Compound',
    briefing: 'Lance has intel on a rival gang hideout. Speed across the city to the compound and clear out the opposition before reinforcements arrive.',
    rewardCash: 8000,
    startTriggerPosition: new THREE.Vector3(60, 0.5, -80),
    triggerRadius: 4.5,
    startWantedLevel: 3,
    steps: [
      {
        description: 'Race to the rival compound',
        targetPosition: new THREE.Vector3(-200, 0.5, 100),
        targetRadius: 6.0,
        requiresVehicle: true,
        timeLimit: 75,
      },
      {
        description: 'Clear the compound and reach the exit',
        targetPosition: new THREE.Vector3(-180, 0.5, 140),
        targetRadius: 5.0,
        timeLimit: 60,
      },
    ],
  },
  {
    id: 'mission_6',
    title: 'DEMOLITION MAN',
    subtitle: 'Construction Site Sabotage',
    briefing: 'Avery Carrington wants the competition demolished. Plant charges at 4 structural columns around the site before security catches on.',
    rewardCash: 6500,
    startTriggerPosition: new THREE.Vector3(-40, 0.5, -120),
    triggerRadius: 4.5,
    steps: [
      {
        description: 'Plant Charge 1: North Column',
        targetPosition: new THREE.Vector3(-60, 0.5, -160),
        targetRadius: 4.0,
        timeLimit: 40,
      },
      {
        description: 'Plant Charge 2: East Column',
        targetPosition: new THREE.Vector3(-20, 0.5, -180),
        targetRadius: 4.0,
        timeLimit: 40,
      },
      {
        description: 'Plant Charge 3: South Column',
        targetPosition: new THREE.Vector3(-60, 0.5, -200),
        targetRadius: 4.0,
        timeLimit: 40,
      },
      {
        description: 'Escape to safe distance!',
        targetPosition: new THREE.Vector3(30, 0.5, -100),
        targetRadius: 7.0,
        timeLimit: 30,
      },
    ],
  },
  {
    id: 'mission_7',
    title: 'THE JOB',
    subtitle: 'Malibu Club Bank Heist',
    briefing: 'It\'s time for the big one. Rob the El Banco Corrupto Grande! Grab a fast car, hit the vault location, and escape before the 5-star heat closes in.',
    rewardCash: 15000,
    startTriggerPosition: new THREE.Vector3(-80, 0.5, -20),
    triggerRadius: 4.5,
    startWantedLevel: 4,
    steps: [
      {
        description: 'Drive to the bank vault',
        targetPosition: new THREE.Vector3(40, 0.5, 60),
        targetRadius: 5.0,
        requiresVehicle: true,
        timeLimit: 50,
      },
      {
        description: 'Collect the cash and escape!',
        targetPosition: new THREE.Vector3(-160, 0.5, -140),
        targetRadius: 7.0,
        requiresVehicle: true,
        timeLimit: 90,
      },
    ],
  },
  {
    id: 'mission_8',
    title: 'RECKONING',
    subtitle: 'Diaz Must Pay',
    briefing: 'Diaz set you up from the start. Assault his mansion compound, fight through his guards, and reach his penthouse office to settle the score.',
    rewardCash: 12000,
    startTriggerPosition: new THREE.Vector3(-120, 0.5, 120),
    triggerRadius: 4.5,
    startWantedLevel: 3,
    steps: [
      {
        description: 'Storm the mansion gates',
        targetPosition: new THREE.Vector3(-150, 0.5, 160),
        targetRadius: 5.0,
        timeLimit: 60,
      },
      {
        description: 'Reach Diaz\'s penthouse office',
        targetPosition: new THREE.Vector3(-160, 0.5, 180),
        targetRadius: 4.0,
        timeLimit: 90,
      },
    ],
  },
  {
    id: 'mission_9',
    title: 'CAP THE COLLECTOR',
    subtitle: 'Print Works Protection',
    briefing: 'The Forelli family is sending a collector to your Print Works. Intercept him before he reaches the factory and take him out.',
    rewardCash: 9000,
    startTriggerPosition: new THREE.Vector3(150, 0.5, -80),
    triggerRadius: 4.5,
    steps: [
      {
        description: 'Race to intercept the Forelli collector',
        targetPosition: new THREE.Vector3(50, 0.5, -150),
        targetRadius: 5.0,
        requiresVehicle: true,
        timeLimit: 55,
      },
      {
        description: 'Return to the Print Works',
        targetPosition: new THREE.Vector3(150, 0.5, -80),
        targetRadius: 5.0,
        requiresVehicle: true,
        timeLimit: 60,
      },
    ],
  },
  {
    id: 'mission_10',
    title: 'KEEP YOUR FRIENDS CLOSE',
    subtitle: 'The Final Showdown',
    briefing: 'Sonny Forelli is coming to Vice City with an army. Defend your empire! Race across the city to secure 3 key locations before they fall.',
    rewardCash: 25000,
    startTriggerPosition: new THREE.Vector3(0, 0.5, 0),
    triggerRadius: 5.0,
    startWantedLevel: 5,
    steps: [
      {
        description: 'Secure the Malibu Club',
        targetPosition: new THREE.Vector3(-80, 0.5, -20),
        targetRadius: 6.0,
        requiresVehicle: true,
        timeLimit: 60,
      },
      {
        description: 'Defend the Print Works',
        targetPosition: new THREE.Vector3(150, 0.5, -80),
        targetRadius: 6.0,
        requiresVehicle: true,
        timeLimit: 60,
      },
      {
        description: 'Return to Vercetti Estate and confront Sonny!',
        targetPosition: new THREE.Vector3(0, 0.5, 0),
        targetRadius: 5.0,
        timeLimit: 90,
      },
    ],
  },
];

