import * as THREE from 'three';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { AudioManager } from './audio/AudioManager';
import { City } from './world/City';
import { Player, PlayerState, WeaponType } from './entities/Player';
import { Vehicle, VehicleConfig } from './entities/Vehicle';
import { HUD } from './ui/HUD';
import { DayNightCycle } from './world/DayNightCycle';
import { SaveManager, GameSaveData } from './save/SaveManager';
import { PedestrianManager } from './ai/PedestrianManager';
import { TrafficManager } from './ai/TrafficManager';
import { PoliceSystem } from './ai/PoliceSystem';
import { MissionManager } from './missions/MissionManager';
import { CollectiblesManager } from './world/CollectiblesManager';

class Game {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private physics: PhysicsWorld;
  private audio: AudioManager;
  private city: City;
  private player: Player;
  private hud: HUD;

  // Systems
  private dayNight: DayNightCycle;
  private pedManager: PedestrianManager;
  private trafficManager: TrafficManager;
  private policeSystem: PoliceSystem;
  private missionManager: MissionManager;
  private collectiblesManager: CollectiblesManager;

  // Parked & Free Roam Vehicles
  private vehicles: Vehicle[] = [];
  private nearbyVehicle: Vehicle | null = null;

  // Game Economy & State
  private cash = 2500;
  private isPaused = false;
  private isGameOver = false;

  private lastTime = performance.now();
  private isPointerLocked = false;
  private isGameStarted = false;
  private autoSaveTimer = 0;

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

    // 1. WebGL Renderer with ACES Filmic Tone Mapping for vibrant 80s neon glow
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // 2. Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf472b6);
    this.scene.fog = new THREE.FogExp2(0xfbcfe8, 0.0032);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 900);

    // 4. Dynamic 24h Miami Day/Night Atmosphere
    this.dayNight = new DayNightCycle(this.scene);

    // 5. Physics & Audio
    this.physics = new PhysicsWorld();
    this.audio = new AudioManager();

    // 6. Tropical Metropolis (Ocean Drive, Art Deco Hotels, Beach, Palm Boulevard)
    this.city = new City(this.scene, this.physics);

    // 7. Player Character (Articulated Rig, Combat, Camera)
    this.player = new Player(this.scene, this.physics, this.audio, this.camera);

    // 8. HUD & Radar
    this.hud = new HUD();

    // 9. AI Systems: Pedestrians, Traffic, Police
    this.pedManager = new PedestrianManager(this.scene, this.physics, this.city);
    this.trafficManager = new TrafficManager(this.scene, this.physics, this.audio, this.city);
    this.policeSystem = new PoliceSystem(this.scene, this.physics, this.audio, this.city);

    // 10. Missions & Collectibles
    this.missionManager = new MissionManager(this.scene, this.audio, this.policeSystem);
    this.collectiblesManager = new CollectiblesManager(this.scene, this.audio);

    // 11. Parked Vice City Vehicles fleet
    this.spawnParkedVehicles();

    // 12. Load Persistent Save Data
    this.loadSavedGame();

    // 13. Wire Callbacks & Events
    this.setupCombatAndCrimeCallbacks();
    this.setupMissionCallbacks();
    this.setupDeathAndArrestCallbacks();

    // 14. Inputs & Menus
    this.setupInputs();
    this.setupUI();

    // 15. Start Loop
    requestAnimationFrame(this.animate.bind(this));
  }

  private loadSavedGame(): void {
    const save = SaveManager.load();
    this.cash = save.cash;
    this.hud.setCash(this.cash);
    this.player.health = save.health;
    this.player.armor = save.armor;
    this.player.stamina = save.stamina;
    this.player.pistolAmmo = save.pistolAmmo;
    this.player.setWeapon(save.currentWeapon);

    if (save.completedMissions && save.completedMissions.length > 0) {
      for (const mId of save.completedMissions) {
        this.missionManager.completedMissionIds.add(mId);
      }
    }
  }

  private saveCurrentGame(): void {
    const saveData: GameSaveData = {
      version: 1,
      cash: this.cash,
      health: this.player.health,
      armor: this.player.armor,
      stamina: this.player.stamina,
      position: {
        x: this.player.body.position.x,
        y: this.player.body.position.y,
        z: this.player.body.position.z,
      },
      completedMissions: Array.from(this.missionManager.completedMissionIds),
      activeMissionId: this.missionManager.activeMission ? this.missionManager.activeMission.id : null,
      currentWeapon: this.player.currentWeapon,
      pistolAmmo: this.player.pistolAmmo,
      settings: {
        soundVolume: 0.8,
        radioVolume: 0.7,
        mouseSensitivity: 1.0,
        dayNightSpeed: this.dayNight.timeSpeed,
      },
    };

    if (SaveManager.save(saveData)) {
      this.hud.showToast('💾 GAME PROGRESS SAVED', 2500);
    }
  }

  private setupCombatAndCrimeCallbacks(): void {
    // When player punches or shoots, perform hit detection against pedestrians
    this.player.onAttackCallback = (pos, yaw, weapon) => {
      const hitPed = this.pedManager.handlePlayerAttack(pos, yaw, weapon);
      if (hitPed) {
        // Attacking pedestrians generates wanted level
        this.policeSystem.addCrime(1);
      } else if (weapon === 'pistol') {
        // Gunfire in public attracts police attention
        if (Math.random() < 0.4) {
          this.policeSystem.addCrime(1);
        }
      }
    };

    // When a pedestrian is knocked out, drop cash on the ground!
    this.pedManager.setOnPedestrianDefeated((_ped, pos) => {
      const reward = 40 + Math.floor(Math.random() * 80);
      this.collectiblesManager.createCollectible(
        `drop_${Date.now()}_${Math.random()}`,
        'cash',
        reward,
        new THREE.Vector3(pos.x, 0.6, pos.z)
      );
      this.policeSystem.addCrime(1);
    });
  }

  private setupMissionCallbacks(): void {
    this.missionManager.setCallbacks(
      (mission) => {
        this.hud.showToast(`🎯 MISSION STARTED: ${mission.title}`, 3500);
      },
      (mission, reward) => {
        this.cash += reward;
        this.hud.setCash(this.cash);
        this.policeSystem.clearWanted();
        this.hud.showMissionBanner('MISSION PASSED!', `REWARD: +$${reward.toLocaleString()}`, true);
        this.saveCurrentGame();
      },
      (mission, reason) => {
        this.hud.showMissionBanner('MISSION FAILED', reason || 'Objective was not fulfilled', false);
      },
      (stepDesc) => {
        this.hud.showToast(`Objective: ${stepDesc}`, 3000);
      }
    );
  }

  private setupDeathAndArrestCallbacks(): void {
    this.policeSystem.setCallbacks(
      // BUSTED
      () => {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.hud.showBustedScreen(true);
        if (document.pointerLockElement) document.exitPointerLock();

        // Bail deduction and clear weapons
        this.cash = Math.max(0, this.cash - 500);
        this.hud.setCash(this.cash);
        this.player.pistolAmmo = 0;
        this.player.setWeapon('fists');
        this.policeSystem.clearWanted();

        setTimeout(() => {
          this.hud.showBustedScreen(false);
          this.player.respawn(new THREE.Vector3(-25, 0.5, 30)); // VCPD Station
          this.isGameOver = false;
          this.hud.showToast('Released from Sun Bay Police Station', 3000);
        }, 4000);
      },
      // WASTED
      () => {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.hud.showWastedScreen(true);
        if (document.pointerLockElement) document.exitPointerLock();

        this.cash = Math.max(0, this.cash - 500);
        this.hud.setCash(this.cash);
        this.policeSystem.clearWanted();

        setTimeout(() => {
          this.hud.showWastedScreen(false);
          this.player.respawn(new THREE.Vector3(120, 0.5, -40)); // Ocean View Medical
          this.isGameOver = false;
          this.hud.showToast('Discharged from Ocean View Medical Center', 3000);
        }, 4000);
      }
    );
  }

  private spawnParkedVehicles(): void {
    const configs: Record<string, VehicleConfig> = {
      infernus: {
        type: 'infernus',
        name: 'INFERNUS',
        bodyColor: 0xf8fafc,
        mass: 1250,
        engineForce: 3800,
        maxSteer: 0.52,
        brakeForce: 120,
      },
      cheetah: {
        type: 'cheetah',
        name: 'CHEETAH',
        bodyColor: 0x00f0ff,
        mass: 1300,
        engineForce: 4200,
        maxSteer: 0.5,
        brakeForce: 110,
      },
      cruiser: {
        type: 'cruiser',
        name: 'OCEAN VIEW CRUISER',
        bodyColor: 0xff007f,
        mass: 1500,
        engineForce: 3200,
        maxSteer: 0.46,
        brakeForce: 95,
      },
      police: {
        type: 'police',
        name: 'VCPD SQUAD CAR',
        bodyColor: 0x15803d,
        mass: 1600,
        engineForce: 3500,
        maxSteer: 0.48,
        brakeForce: 130,
      },
      taxi: {
        type: 'taxi',
        name: 'KAUFMAN CAB',
        bodyColor: 0xfacc15,
        mass: 1550,
        engineForce: 3100,
        maxSteer: 0.47,
        brakeForce: 100,
      },
    };

    // 1. Infernus right outside Ocean View Hotel
    const v1 = new Vehicle(this.scene, this.physics, this.audio, configs.infernus, new THREE.Vector3(6, 0.5, 8), 0);
    this.vehicles.push(v1);

    // 2. Cyan Cheetah on Ocean Drive Boulevard
    const v2 = new Vehicle(this.scene, this.physics, this.audio, configs.cheetah, new THREE.Vector3(120, 0.5, 40), Math.PI / 2);
    this.vehicles.push(v2);

    // 3. Hot Pink Convertible by the Art Deco Hotel
    const v3 = new Vehicle(this.scene, this.physics, this.audio, configs.cruiser, new THREE.Vector3(75, 0.5, -20), 0);
    this.vehicles.push(v3);

    // 4. Kaufman Cab in commercial district
    const v5 = new Vehicle(this.scene, this.physics, this.audio, configs.taxi, new THREE.Vector3(-50, 0.5, -60), Math.PI);
    this.vehicles.push(v5);
  }

  private setupInputs(): void {
    const keysDown = new Set<string>();

    window.addEventListener('keydown', (e) => {
      // Escape: Toggle Pause Menu
      if (e.code === 'Escape' && this.isGameStarted && !this.isGameOver) {
        e.preventDefault();
        this.togglePauseMenu();
        return;
      }

      keysDown.add(e.code);

      // F or Enter: Enter or Exit Vehicle
      if (e.code === 'KeyF' || e.code === 'Enter') {
        if (this.player.state === PlayerState.ON_FOOT) {
          if (this.nearbyVehicle) {
            this.player.enterVehicle(this.nearbyVehicle);
            // Carjacking increases police attention
            this.policeSystem.addCrime(1);
            this.hud.showToast(`Vehicle Hijacked: ${this.nearbyVehicle.config.name}`, 2000);
          }
        } else {
          this.player.exitVehicle();
        }
      }

      // Space: Jump on foot
      if (e.code === 'Space' && this.player.state === PlayerState.ON_FOOT) {
        this.player.isJumping = true;
      }

      // Weapons Quick Switch: 1 (Fists), 2 (Bat), 3 (Pistol)
      if (e.code === 'Digit1') this.player.setWeapon('fists');
      if (e.code === 'Digit2') this.player.setWeapon('bat');
      if (e.code === 'Digit3') this.player.setWeapon('pistol');

      // C: Cycle camera distance
      if (e.code === 'KeyC') {
        this.player.cycleCameraDistance();
      }

      // H: Horn / Police Siren / Help
      if (e.code === 'KeyH') {
        if (this.player.state === PlayerState.IN_VEHICLE && this.player.currentVehicle) {
          this.player.currentVehicle.honk();
        } else {
          this.toggleHelpModal();
        }
      }

      // Q / E: Cycle 80s Radio Stations
      if (this.player.state === PlayerState.IN_VEHICLE) {
        if (e.code === 'KeyQ') this.audio.prevRadioStation();
        else if (e.code === 'KeyE') this.audio.nextRadioStation();
      }

      // R: Respawn or flip vehicle upright
      if (e.code === 'KeyR') {
        if (this.player.state === PlayerState.IN_VEHICLE && this.player.currentVehicle) {
          const car = this.player.currentVehicle;
          car.chassisBody.position.y += 2.5;
          car.chassisBody.quaternion.set(0, 0, 0, 1);
          car.chassisBody.velocity.set(0, 0, 0);
          car.chassisBody.angularVelocity.set(0, 0, 0);
        } else {
          this.player.body.position.set(0, 3, 5);
          this.player.body.velocity.set(0, 0, 0);
        }
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleHelpModal();
      }
    });

    window.addEventListener('keyup', (e) => {
      keysDown.delete(e.code);
      if (e.code === 'KeyH' && this.player.currentVehicle) {
        this.player.currentVehicle.stopHonk();
      }
    });

    // Mouse wheel weapon switch
    window.addEventListener('wheel', (e) => {
      const weapons: WeaponType[] = ['fists', 'bat', 'pistol'];
      let idx = weapons.indexOf(this.player.currentWeapon);
      if (e.deltaY > 0) {
        idx = (idx + 1) % weapons.length;
      } else {
        idx = (idx - 1 + weapons.length) % weapons.length;
      }
      this.player.setWeapon(weapons[idx]);
    });

    // Pointer Lock & Mouse Look
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked && this.isGameStarted && !this.isPaused && !this.isGameOver) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && !this.isPaused) {
        this.player.onMouseMove(e.movementX, e.movementY);
      }
    });

    // Left Click: Attack (Punch combo, bat swing, gunshot)
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.isPointerLocked && !this.isPaused) {
        this.player.triggerAttack();
      }
      if (e.button === 2 && !this.isPaused) {
        this.player.isAiming = true;
        document.getElementById('crosshair')?.classList.add('aiming');
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.player.isAiming = false;
        document.getElementById('crosshair')?.classList.remove('aiming');
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Process continuous inputs
    this.processInputs = () => {
      if (this.isPaused || this.isGameOver) return;

      const w = keysDown.has('KeyW') || keysDown.has('ArrowUp');
      const s = keysDown.has('KeyS') || keysDown.has('ArrowDown');
      const a = keysDown.has('KeyA') || keysDown.has('ArrowLeft');
      const d = keysDown.has('KeyD') || keysDown.has('ArrowRight');
      const shift = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
      const space = keysDown.has('Space');

      if (this.player.state === PlayerState.ON_FOOT) {
        this.player.moveForward = (w ? 1 : 0) - (s ? 1 : 0);
        this.player.moveRight = (d ? 1 : 0) - (a ? 1 : 0);
        this.player.isSprinting = shift;
      } else if (this.player.state === PlayerState.IN_VEHICLE && this.player.currentVehicle) {
        const throttle = (w ? 1 : 0) - (s ? 1 : 0);
        const steer = (a ? 1 : 0) - (d ? 1 : 0);
        this.player.currentVehicle.setInputs(throttle, steer, space);
      }
    };
  }

  private processInputs: () => void = () => {};

  private setupUI(): void {
    const startOverlay = document.getElementById('start-overlay')!;
    const startBtn = document.getElementById('start-btn')!;
    const controlsHelp = document.getElementById('controls-help')!;
    const closeHelpBtn = document.getElementById('close-help-btn')!;
    const toggleHelpBtn = document.getElementById('toggle-help-btn')!;

    // Start Screen
    startBtn.addEventListener('click', () => {
      this.audio.init();
      startOverlay.classList.add('hidden');
      this.isGameStarted = true;
      this.canvas.requestPointerLock();
      this.hud.showToast('🌴 WELCOME TO SUN BAY • VICE CITY REMASTER', 4000);
    });

    closeHelpBtn.addEventListener('click', () => {
      controlsHelp.classList.add('hidden');
    });

    toggleHelpBtn.addEventListener('click', () => {
      this.toggleHelpModal();
    });

    // Pause Menu actions
    const pauseMenu = document.getElementById('pause-menu')!;
    const resumeBtn = document.getElementById('pause-resume-btn')!;
    const saveBtn = document.getElementById('pause-save-btn')!;
    const controlsBtn = document.getElementById('pause-controls-btn')!;
    const resetBtn = document.getElementById('pause-reset-btn')!;
    const restartMissionBtn = document.getElementById('pause-restart-mission-btn')!;

    resumeBtn.addEventListener('click', () => {
      this.togglePauseMenu();
      this.canvas.requestPointerLock();
    });

    saveBtn.addEventListener('click', () => {
      this.saveCurrentGame();
    });

    controlsBtn.addEventListener('click', () => {
      pauseMenu.classList.add('hidden');
      controlsHelp.classList.remove('hidden');
    });

    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all game progress?')) {
        SaveManager.reset();
        window.location.reload();
      }
    });

    restartMissionBtn.addEventListener('click', () => {
      this.missionManager.restartMission();
      this.togglePauseMenu();
      this.canvas.requestPointerLock();
    });

    // Time of day buttons in pause menu
    const timeButtons = document.querySelectorAll('.pause-time-picker .time-btn');
    timeButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const hour = parseFloat((e.target as HTMLElement).getAttribute('data-hour') || '12');
        this.dayNight.setTime(hour);
        this.hud.showToast(`Time set to ${this.dayNight.getFormattedTime()}`, 2000);
      });
    });

    // Weapon switcher buttons
    const weaponButtons = document.querySelectorAll('.weapon-switcher .weapon-btn');
    const weapons: WeaponType[] = ['fists', 'bat', 'pistol'];
    weaponButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        this.player.setWeapon(weapons[idx]);
      });
    });
  }

  private togglePauseMenu(): void {
    const pauseMenu = document.getElementById('pause-menu')!;
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      pauseMenu.classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();

      const restartMissionBtn = document.getElementById('pause-restart-mission-btn')!;
      if (this.missionManager.activeMission) {
        restartMissionBtn.classList.remove('hidden');
      } else {
        restartMissionBtn.classList.add('hidden');
      }
    } else {
      pauseMenu.classList.add('hidden');
    }
  }

  private toggleHelpModal(): void {
    const controlsHelp = document.getElementById('controls-help')!;
    controlsHelp.classList.toggle('hidden');
    if (!controlsHelp.classList.contains('hidden') && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  private checkVehicleProximity(): void {
    if (this.player.state === PlayerState.IN_VEHICLE) {
      this.nearbyVehicle = null;
      this.hud.showPrompt('EXIT VEHICLE [F]');
      return;
    }

    const playerPos = this.player.getPosition();
    let closestDist = Infinity;
    let closestVehicle: Vehicle | null = null;

    // Check parked vehicles + traffic vehicles + police vehicles
    const allVehicles = [
      ...this.vehicles,
      ...this.trafficManager.getAllVehicles(),
      ...this.policeSystem.policeCars.map((p) => p.vehicle),
    ];

    for (const v of allVehicles) {
      const doorPos = v.getDriverDoorPosition();
      const dist = playerPos.distanceTo(doorPos);
      if (dist < 4.2 && dist < closestDist) {
        closestDist = dist;
        closestVehicle = v;
      }
    }

    this.nearbyVehicle = closestVehicle;
    if (closestVehicle) {
      this.hud.showPrompt(`ENTER ${closestVehicle.config.name} [F]`);
    } else {
      this.hud.hidePrompt();
    }
  }

  private animate(now: number): void {
    requestAnimationFrame(this.animate.bind(this));

    const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.isPaused) {
      // Still render scene when paused
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 1. Process continuous inputs
    this.processInputs();

    // 2. Physics simulation
    this.physics.step(deltaTime);

    // 3. Day/Night progression
    this.dayNight.update(deltaTime);

    // 4. Update Parked Vehicles
    for (const v of this.vehicles) {
      v.update(deltaTime);
    }

    // 5. Player update
    this.player.update(deltaTime);
    const playerPos = this.player.getPosition();

    // 6. AI Systems (Pedestrians, Traffic, Police)
    this.pedManager.update(deltaTime, playerPos);
    this.trafficManager.update(deltaTime, playerPos, this.player.currentVehicle);
    this.policeSystem.update(deltaTime, this.player);

    // 7. Missions & Collectibles
    this.missionManager.update(deltaTime, this.player);
    this.collectiblesManager.update(deltaTime, this.player, (item) => {
      if (item.type === 'cash') {
        this.cash += item.value;
        this.hud.setCash(this.cash);
        this.hud.showToast(`+$${item.value} Picked Up!`, 2000);
      } else if (item.type === 'health') {
        this.hud.showToast('Health Restored +50', 2000);
      } else if (item.type === 'armor') {
        this.hud.showToast('Body Armor Equipped +50', 2000);
      } else if (item.type === 'ammo') {
        this.hud.showToast('Ammunition +30 Rounds', 2000);
      }
    });

    // 8. Vehicle Proximity Check
    this.checkVehicleProximity();

    // 9. Sync Wanted Level on HUD
    this.hud.setWantedLevel(this.policeSystem.wantedLevel, this.policeSystem.isCoolingDown);

    // 10. Update HUD, Minimap Radar & Speedometer
    const visibleVehicles = [
      ...this.vehicles,
      ...this.trafficManager.getAllVehicles(),
      ...this.policeSystem.policeCars.map((p) => p.vehicle),
    ];

    this.hud.update(
      this.player,
      visibleVehicles,
      this.city,
      this.audio.getRadioStation(),
      this.missionManager,
      this.dayNight.getFormattedTime()
    );

    // 11. Auto-save every 35 seconds
    this.autoSaveTimer += deltaTime;
    if (this.autoSaveTimer > 35) {
      this.autoSaveTimer = 0;
      this.saveCurrentGame();
    }

    // 12. Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
