import * as THREE from 'three';
import { Player, PlayerState, WeaponType } from '../entities/Player';
import { Vehicle } from '../entities/Vehicle';
import { City } from '../world/City';
import { MissionManager } from '../missions/MissionManager';

export class HUD {
  private radarCanvas: HTMLCanvasElement;
  private radarCtx: CanvasRenderingContext2D;

  private actionPrompt: HTMLElement;
  private promptText: HTMLElement;
  private vehicleHud: HTMLElement;
  private vehicleModelName: HTMLElement;
  private speedValue: HTMLElement;
  private gearIndicator: HTMLElement;
  private rpmBarFill: HTMLElement;
  private radioStationName: HTMLElement;
  private locationLabel: HTMLElement;

  private hudCash: HTMLElement;
  private healthFill: HTMLElement;
  private armorFill: HTMLElement;
  private staminaFill: HTMLElement;
  private healthNum: HTMLElement;
  private armorNum: HTMLElement;

  private weaponIcon: HTMLElement;
  private weaponName: HTMLElement;
  private weaponAmmo: HTMLElement;
  private weaponButtons: NodeListOf<HTMLButtonElement>;

  private wantedStars: NodeListOf<HTMLElement>;
  private wantedLevel = 0;

  // Mission HUD elements
  private missionHud: HTMLElement;
  private missionTitle: HTMLElement;
  private missionObjective: HTMLElement;
  private missionTimerContainer: HTMLElement;
  private missionTimer: HTMLElement;

  // Notification and banner
  private notificationToast: HTMLElement;
  private toastText: HTMLElement;
  private toastTimeout: number | null = null;

  private missionBanner: HTMLElement;
  private bannerTitle: HTMLElement;
  private bannerSubtitle: HTMLElement;
  private bannerTimeout: number | null = null;

  // Death screens
  private bustedScreen: HTMLElement;
  private wastedScreen: HTMLElement;

  private neighborhoods = [
    { name: 'OCEAN BEACH, OCEAN DRIVE', minX: 80, maxX: 200, minZ: -300, maxZ: 300 },
    { name: 'WASHINGTON BEACH', minX: -50, maxX: 80, minZ: -100, maxZ: 100 },
    { name: 'STARFISH ISLAND MANSIONS', minX: -150, maxX: -50, minZ: -150, maxZ: 150 },
    { name: 'VICE POINT SHOPPING MALL', minX: -50, maxX: 80, minZ: 100, maxZ: 300 },
    { name: 'LITTLE HAITI & ESCOBAR INT.', minX: -300, maxX: -150, minZ: -300, maxZ: 300 },
  ];

  constructor() {
    this.radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
    this.radarCtx = this.radarCanvas.getContext('2d')!;

    this.actionPrompt = document.getElementById('action-prompt')!;
    this.promptText = document.getElementById('prompt-text')!;
    this.vehicleHud = document.getElementById('vehicle-hud')!;
    this.vehicleModelName = document.getElementById('vehicle-model-name')!;
    this.speedValue = document.getElementById('speed-value')!;
    this.gearIndicator = document.getElementById('gear-indicator')!;
    this.rpmBarFill = document.getElementById('rpm-bar-fill')!;
    this.radioStationName = document.getElementById('radio-station-name')!;
    this.locationLabel = document.getElementById('location-label')!;

    this.hudCash = document.getElementById('hud-cash')!;
    this.healthFill = document.getElementById('health-fill')!;
    this.armorFill = document.getElementById('armor-fill')!;
    this.staminaFill = document.getElementById('stamina-fill')!;
    this.healthNum = document.getElementById('health-num')!;
    this.armorNum = document.getElementById('armor-num')!;

    this.weaponIcon = document.getElementById('weapon-icon')!;
    this.weaponName = document.getElementById('weapon-name')!;
    this.weaponAmmo = document.getElementById('weapon-ammo')!;
    this.weaponButtons = document.querySelectorAll('.weapon-switcher .weapon-btn');

    this.wantedStars = document.querySelectorAll('.wanted-stars .star');

    this.missionHud = document.getElementById('mission-hud')!;
    this.missionTitle = document.getElementById('mission-title')!;
    this.missionObjective = document.getElementById('mission-objective')!;
    this.missionTimerContainer = document.getElementById('mission-timer-container')!;
    this.missionTimer = document.getElementById('mission-timer')!;

    this.notificationToast = document.getElementById('notification-toast')!;
    this.toastText = document.getElementById('toast-text')!;

    this.missionBanner = document.getElementById('mission-banner')!;
    this.bannerTitle = document.getElementById('banner-title')!;
    this.bannerSubtitle = document.getElementById('banner-subtitle')!;

    this.bustedScreen = document.getElementById('busted-screen')!;
    this.wastedScreen = document.getElementById('wasted-screen')!;
  }

  public setCash(cash: number): void {
    const padded = Math.max(0, Math.floor(cash)).toString().padStart(8, '0');
    this.hudCash.textContent = padded;
  }

  public showPrompt(text: string): void {
    this.promptText.textContent = text;
    this.actionPrompt.classList.remove('hidden');
  }

  public hidePrompt(): void {
    this.actionPrompt.classList.add('hidden');
  }

  public setWantedLevel(stars: number, isBlinking = false): void {
    this.wantedLevel = Math.max(0, Math.min(5, stars));
    this.wantedStars.forEach((star, index) => {
      if (index < this.wantedLevel) {
        star.classList.add('active');
        if (isBlinking) {
          star.style.opacity = Math.sin(performance.now() * 0.01) > 0 ? '1' : '0.2';
        } else {
          star.style.opacity = '1';
        }
      } else {
        star.classList.remove('active');
        star.style.opacity = '0.2';
      }
    });
  }

  public showToast(message: string, duration = 3000): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastText.textContent = message;
    this.notificationToast.classList.remove('hidden');
    this.toastTimeout = window.setTimeout(() => {
      this.notificationToast.classList.add('hidden');
    }, duration);
  }

  public showMissionBanner(title: string, subtitle: string, isSuccess = true): void {
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTitle.textContent = title;
    this.bannerTitle.style.color = isSuccess ? '#a3e635' : '#ef4444';
    this.bannerSubtitle.textContent = subtitle;
    this.missionBanner.classList.remove('hidden');

    this.bannerTimeout = window.setTimeout(() => {
      this.missionBanner.classList.add('hidden');
    }, 4500);
  }

  public showBustedScreen(show: boolean): void {
    if (show) this.bustedScreen.classList.remove('hidden');
    else this.bustedScreen.classList.add('hidden');
  }

  public showWastedScreen(show: boolean): void {
    if (show) this.wastedScreen.classList.remove('hidden');
    else this.wastedScreen.classList.add('hidden');
  }

  public updateWeaponHUD(weapon: WeaponType, ammo: number): void {
    const weaponData: Record<WeaponType, { name: string; icon: string; slot: number }> = {
      fists: { name: 'FISTS', icon: '👊', slot: 0 },
      bat: { name: 'BASEBALL BAT', icon: '🏏', slot: 1 },
      katana: { name: 'KATANA', icon: '⚔️', slot: 2 },
      pistol: { name: 'COLT .45', icon: '🔫', slot: 3 },
      shotgun: { name: 'CHROME SHOTGUN', icon: '💥', slot: 4 },
      smg: { name: 'TEC-9', icon: '🔥', slot: 5 },
      m4: { name: 'M4 ASSAULT', icon: '🎯', slot: 6 },
      rpg: { name: 'RPG LAUNCHER', icon: '🚀', slot: 7 },
      grenade: { name: 'GRENADES', icon: '💣', slot: 8 },
    };

    const cur = weaponData[weapon];
    this.weaponName.textContent = cur.name;
    this.weaponIcon.textContent = cur.icon;

    const meleeWeapons = ['fists', 'bat', 'katana'];
    this.weaponAmmo.textContent = meleeWeapons.includes(weapon) ? '∞' : ammo.toString();

    this.weaponButtons.forEach((btn, idx) => {
      if (idx === cur.slot) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  public update(
    player: Player,
    vehicles: Vehicle[],
    city: City,
    radioStation: string,
    missionManager?: MissionManager,
    timeString?: string
  ): void {
    const playerPos = player.getPosition();

    // 1. Location & Time
    let currentNeighborhood = 'VICE CITY METRO';
    for (const zone of this.neighborhoods) {
      if (
        playerPos.x >= zone.minX &&
        playerPos.x <= zone.maxX &&
        playerPos.z >= zone.minZ &&
        playerPos.z <= zone.maxZ
      ) {
        currentNeighborhood = zone.name;
        break;
      }
    }
    this.locationLabel.textContent = timeString
      ? `${currentNeighborhood} • ${timeString}`
      : currentNeighborhood;

    // 2. Health & Armor & Stamina
    const hp = Math.max(0, Math.round(player.health));
    const arm = Math.max(0, Math.round(player.armor));
    this.healthFill.style.width = `${hp}%`;
    this.armorFill.style.width = `${arm}%`;
    this.staminaFill.style.width = `${Math.max(0, player.stamina)}%`;
    this.healthNum.textContent = hp.toString();
    this.armorNum.textContent = arm.toString();

    // 3. Weapon
    this.updateWeaponHUD(player.currentWeapon, player.pistolAmmo);

    // 4. Vehicle Speedometer
    if (player.state === PlayerState.IN_VEHICLE && player.currentVehicle) {
      this.vehicleHud.classList.remove('hidden');
      const car = player.currentVehicle;
      const mph = Math.round(car.getSpeedMph());

      this.vehicleModelName.textContent = car.config.name;
      this.speedValue.textContent = mph.toString();
      this.gearIndicator.textContent = car.getGear();

      const rpmRatio = (mph % 26) / 26;
      this.rpmBarFill.style.width = `${Math.min(100, Math.max(15, rpmRatio * 100))}%`;
      this.radioStationName.textContent = radioStation;
    } else {
      this.vehicleHud.classList.add('hidden');
    }

    // 5. Mission HUD Card
    if (missionManager && missionManager.activeMission) {
      this.missionHud.classList.remove('hidden');
      this.missionTitle.textContent = missionManager.activeMission.title;
      const step = missionManager.activeMission.steps[missionManager.currentStepIndex];
      this.missionObjective.textContent = step.description;

      if (missionManager.stepTimeRemaining > 0) {
        this.missionTimerContainer.classList.remove('hidden');
        const mins = Math.floor(missionManager.stepTimeRemaining / 60);
        const secs = Math.floor(missionManager.stepTimeRemaining % 60);
        this.missionTimer.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
      } else {
        this.missionTimerContainer.classList.add('hidden');
      }
    } else {
      this.missionHud.classList.add('hidden');
    }

    // 6. Radar Canvas
    this.renderRadar(player, vehicles, city, missionManager);
  }

  private renderRadar(player: Player, vehicles: Vehicle[], city: City, missionManager?: MissionManager): void {
    const ctx = this.radarCtx;
    const width = this.radarCanvas.width;
    const height = this.radarCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radarRadius = width / 2 - 2;

    const playerPos = player.getPosition();
    const heading = player.state === PlayerState.ON_FOOT
      ? player.cameraYaw
      : -player.currentVehicle!.mesh.rotation.y;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    ctx.clip();

    // Dark purple Vice City background
    ctx.fillStyle = '#180e2b';
    ctx.fillRect(0, 0, width, height);

    ctx.translate(centerX, centerY);
    ctx.rotate(heading);

    const radarScale = 0.55;

    // Ocean water area (X > 240)
    const oceanX = (240 - playerPos.x) * radarScale;
    ctx.fillStyle = '#0e7490';
    ctx.fillRect(oceanX, -radarRadius - 100, 300, (radarRadius + 100) * 2);

    // Sand Beach (160 to 240)
    const sandX = (160 - playerPos.x) * radarScale;
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(sandX, -radarRadius - 100, 80 * radarScale, (radarRadius + 100) * 2);

    // Roads
    ctx.strokeStyle = '#3b2554';
    ctx.lineWidth = 14 * radarScale;
    ctx.lineCap = 'round';
    for (const road of city.roads) {
      const rx1 = (road.x1 - playerPos.x) * radarScale;
      const rz1 = (road.z1 - playerPos.z) * radarScale;
      const rx2 = (road.x2 - playerPos.x) * radarScale;
      const rz2 = (road.z2 - playerPos.z) * radarScale;

      ctx.beginPath();
      ctx.moveTo(rx1, rz1);
      ctx.lineTo(rx2, rz2);
      ctx.stroke();
    }

    // Ocean Drive Boulevard
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4 * radarScale;
    for (const road of city.roads) {
      if (road.isMainBoulevard) {
        const rx1 = (road.x1 - playerPos.x) * radarScale;
        const rz1 = (road.z1 - playerPos.z) * radarScale;
        const rx2 = (road.x2 - playerPos.x) * radarScale;
        const rz2 = (road.z2 - playerPos.z) * radarScale;

        ctx.beginPath();
        ctx.moveTo(rx1, rz1);
        ctx.lineTo(rx2, rz2);
        ctx.stroke();
      }
    }

    // Buildings
    for (const b of city.buildings) {
      const bx = (b.x - playerPos.x) * radarScale;
      const bz = (b.z - playerPos.z) * radarScale;
      const bw = b.width * radarScale;
      const bd = b.depth * radarScale;

      if (Math.hypot(bx, bz) < radarRadius + 40) {
        ctx.fillStyle = b.isArtDeco ? '#ff007f' : '#4a2870';
        ctx.fillRect(bx - bw / 2, bz - bd / 2, bw, bd);
      }
    }

    // Vehicle Blips
    for (const v of vehicles) {
      if (v === player.currentVehicle) continue;
      const vx = (v.mesh.position.x - playerPos.x) * radarScale;
      const vz = (v.mesh.position.z - playerPos.z) * radarScale;

      if (Math.hypot(vx, vz) < radarRadius - 6) {
        let blipColor = '#ff007f';
        if (v.config.type === 'cheetah') blipColor = '#00f0ff';
        else if (v.config.type === 'police') blipColor = '#22c55e';
        else if (v.config.type === 'taxi') blipColor = '#facc15';
        else if (v.config.type === 'cruiser') blipColor = '#f472b6';

        ctx.fillStyle = blipColor;
        ctx.beginPath();
        ctx.arc(vx, vz, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Active Mission Waypoint on Radar
    if (missionManager && missionManager.activeMission) {
      const wp = missionManager.getActiveWaypointPosition();
      if (wp) {
        let wx = (wp.x - playerPos.x) * radarScale;
        let wz = (wp.z - playerPos.z) * radarScale;
        const distToWp = Math.hypot(wx, wz);

        // Clamp to radar perimeter if off-screen
        if (distToWp > radarRadius - 10) {
          const ratio = (radarRadius - 10) / distToWp;
          wx *= ratio;
          wz *= ratio;
        }

        // Pulsing yellow waypoint dot
        const pulse = 1.0 + Math.sin(performance.now() * 0.008) * 0.3;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(wx, wz, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wz, 9 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Radar border ring
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
