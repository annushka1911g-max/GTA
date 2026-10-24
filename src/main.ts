import * as THREE from 'three';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { AudioManager } from './audio/AudioManager';
import { City } from './world/City';
import { Player, PlayerState, WeaponType } from './entities/Player';
import { Vehicle, VehicleConfig } from './entities/Vehicle';
import { HUD } from './ui/HUD';

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

  private vehicles: Vehicle[] = [];
  private nearbyVehicle: Vehicle | null = null;

  private lastTime = performance.now();
  private isPointerLocked = false;
  private isGameStarted = false;

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

    // 1. Renderer with ACES Filmic Tone Mapping for vibrant 80s neon glow
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

    // 2. 1980s Miami Sunset Sky & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf472b6); // Vibrant 80s pink sunset sky
    this.scene.fog = new THREE.FogExp2(0xfbcfe8, 0.0032); // Miami tropical haze

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 900);

    // 4. Miami Golden Hour Sunset Lighting
    this.setupViceCityLighting();

    // 5. Physics & Audio
    this.physics = new PhysicsWorld();
    this.audio = new AudioManager();

    // 6. Vice City (Ocean Drive, Beach, Art Deco Hotels)
    this.city = new City(this.scene, this.physics);

    // 7. Tommy Vercetti Character
    this.player = new Player(this.scene, this.physics, this.audio, this.camera);

    // 8. HUD & Radar
    this.hud = new HUD();

    // 9. Spawn Fleet of Vice City Vehicles
    this.spawnViceCityVehicles();

    // 10. Inputs & UI
    this.setupInputs();
    this.setupUI();

    // 11. Start Loop
    requestAnimationFrame(this.animate.bind(this));
  }

  /**
   * 1980s Miami Golden Hour Sunset Lighting
   */
  private setupViceCityLighting(): void {
    // Warm magenta & cyan hemisphere bounce
    const hemiLight = new THREE.HemisphereLight(0xf43f5e, 0x06b6d4, 0.7);
    this.scene.add(hemiLight);

    // Low angle golden sun casting dramatic palm tree shadows across Ocean Drive
    const sunLight = new THREE.DirectionalLight(0xfbbf24, 1.6);
    sunLight.position.set(140, 110, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;

    const d = 90;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;

    this.scene.add(sunLight);

    // Subtle neon pink fill light from the Art Deco facades
    const neonFill = new THREE.DirectionalLight(0xff007f, 0.45);
    neonFill.position.set(-100, 60, -60);
    this.scene.add(neonFill);
  }

  /**
   * Spawns iconic Vice City vehicles: Infernus, Cheetah, Ocean Cruiser, VCPD, Kaufman Cab
   */
  private spawnViceCityVehicles(): void {
    const configs: Record<string, VehicleConfig> = {
      infernus: {
        type: 'infernus',
        name: 'INFERNUS',
        bodyColor: 0xf8fafc, // Iconic white 80s Countach
        mass: 1250,
        engineForce: 3800,
        maxSteer: 0.52,
        brakeForce: 120,
      },
      cheetah: {
        type: 'cheetah',
        name: 'CHEETAH',
        bodyColor: 0x00f0ff, // Electric Miami cyan Testarossa
        mass: 1300,
        engineForce: 4200,
        maxSteer: 0.50,
        brakeForce: 110,
      },
      cruiser: {
        type: 'cruiser',
        name: 'OCEAN VIEW CRUISER',
        bodyColor: 0xff007f, // Hot pink retro convertible
        mass: 1500,
        engineForce: 3200,
        maxSteer: 0.46,
        brakeForce: 95,
      },
      police: {
        type: 'police',
        name: 'VCPD SQUAD CAR',
        bodyColor: 0x15803d, // Green & White VCPD squad car
        mass: 1600,
        engineForce: 3500,
        maxSteer: 0.48,
        brakeForce: 130,
      },
      taxi: {
        type: 'taxi',
        name: 'KAUFMAN CAB',
        bodyColor: 0xfacc15, // Yellow checkered taxi
        mass: 1550,
        engineForce: 3100,
        maxSteer: 0.47,
        brakeForce: 100,
      },
    };

    // 1. Infernus right in front of Tommy Vercetti
    const v1 = new Vehicle(
      this.scene,
      this.physics,
      this.audio,
      configs.infernus,
      new THREE.Vector3(6, 0.5, 8),
      0
    );
    this.vehicles.push(v1);

    // 2. Cyan Cheetah on Ocean Drive
    const v2 = new Vehicle(
      this.scene,
      this.physics,
      this.audio,
      configs.cheetah,
      new THREE.Vector3(120, 0.5, 40),
      Math.PI / 2
    );
    this.vehicles.push(v2);

    // 3. Hot Pink Convertible by the Art Deco Hotel
    const v3 = new Vehicle(
      this.scene,
      this.physics,
      this.audio,
      configs.cruiser,
      new THREE.Vector3(75, 0.5, -20),
      0
    );
    this.vehicles.push(v3);

    // 4. VCPD Police Cruiser at the intersection
    const v4 = new Vehicle(
      this.scene,
      this.physics,
      this.audio,
      configs.police,
      new THREE.Vector3(-25, 0.5, 30),
      -Math.PI / 2
    );
    this.vehicles.push(v4);

    // 5. Kaufman Cab
    const v5 = new Vehicle(
      this.scene,
      this.physics,
      this.audio,
      configs.taxi,
      new THREE.Vector3(-50, 0.5, -60),
      Math.PI
    );
    this.vehicles.push(v5);
  }

  /**
   * Keyboard, Mouse & Weapon Inputs
   */
  private setupInputs(): void {
    const keysDown = new Set<string>();

    window.addEventListener('keydown', (e) => {
      keysDown.add(e.code);

      // F or Enter: Enter or Exit Vehicle
      if (e.code === 'KeyF' || e.code === 'Enter') {
        if (this.player.state === PlayerState.ON_FOOT) {
          if (this.nearbyVehicle) {
            this.player.enterVehicle(this.nearbyVehicle);
            this.hud.setWantedLevel(1);
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
      if (!this.isPointerLocked && this.isGameStarted) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.player.onMouseMove(e.movementX, e.movementY);
      }
    });

    // Left Click: Attack (Punch combo, bat swing, gunshot)
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.isPointerLocked) {
        this.player.triggerAttack();
      }
      if (e.button === 2) {
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

  /**
   * UI Setup (Start Screen, Controls Panel, Weapon Switcher buttons)
   */
  private setupUI(): void {
    const startOverlay = document.getElementById('start-overlay')!;
    const startBtn = document.getElementById('start-btn')!;
    const controlsHelp = document.getElementById('controls-help')!;
    const closeHelpBtn = document.getElementById('close-help-btn')!;
    const toggleHelpBtn = document.getElementById('toggle-help-btn')!;

    startBtn.addEventListener('click', () => {
      this.audio.init();
      startOverlay.classList.add('hidden');
      this.isGameStarted = true;
      this.canvas.requestPointerLock();
    });

    closeHelpBtn.addEventListener('click', () => {
      controlsHelp.classList.add('hidden');
    });

    toggleHelpBtn.addEventListener('click', () => {
      this.toggleHelpModal();
    });

    // Weapon switcher button click listeners
    const weaponButtons = document.querySelectorAll('.weapon-switcher .weapon-btn');
    const weapons: WeaponType[] = ['fists', 'bat', 'pistol'];
    weaponButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        this.player.setWeapon(weapons[idx]);
      });
    });
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
      this.hud.showPrompt('EXIT VEHICLE');
      return;
    }

    const playerPos = this.player.getPosition();
    let closestDist = Infinity;
    let closestVehicle: Vehicle | null = null;

    for (const v of this.vehicles) {
      const doorPos = v.getDriverDoorPosition();
      const dist = playerPos.distanceTo(doorPos);
      if (dist < 4.0 && dist < closestDist) {
        closestDist = dist;
        closestVehicle = v;
      }
    }

    this.nearbyVehicle = closestVehicle;
    if (closestVehicle) {
      this.hud.showPrompt(`HIJACK ${closestVehicle.config.name}`);
    } else {
      this.hud.hidePrompt();
    }
  }

  private animate(now: number): void {
    requestAnimationFrame(this.animate.bind(this));

    const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // 1. Process inputs
    this.processInputs();

    // 2. Physics simulation
    this.physics.step(deltaTime);

    // 3. Vehicles update
    for (const v of this.vehicles) {
      v.update(deltaTime);
    }

    // 4. Player update
    this.player.update(deltaTime);

    // 5. Check vehicle proximity
    this.checkVehicleProximity();

    // 6. Update HUD, Minimap Radar & Speedometer
    this.hud.update(
      this.player,
      this.vehicles,
      this.city,
      this.audio.getRadioStation()
    );

    // 7. Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
