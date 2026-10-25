import * as THREE from 'three';

export interface DayNightColors {
  sky: number;
  fog: number;
  sun: number;
  ambient: number;
  sunIntensity: number;
  ambientIntensity: number;
}

export class DayNightCycle {
  private scene: THREE.Scene;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private neonFill: THREE.DirectionalLight;

  // Time in 24h format: e.g. 18.5 = 6:30 PM (sunset)
  public timeHours = 18.2;
  public timeSpeed = 0.05; // ~8 minutes real time for full 24h cycle
  public isPaused = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Hemisphere bounce light
    this.hemiLight = new THREE.HemisphereLight(0xf43f5e, 0x06b6d4, 0.7);
    this.scene.add(this.hemiLight);

    // 2. Primary Sun / Moon Directional Light
    this.sunLight = new THREE.DirectionalLight(0xfbbf24, 1.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;

    const d = 110;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;

    this.scene.add(this.sunLight);

    // 3. Neon facade ambient fill
    this.neonFill = new THREE.DirectionalLight(0xff007f, 0.45);
    this.neonFill.position.set(-100, 60, -60);
    this.scene.add(this.neonFill);

    this.updateLighting(0);
  }

  public update(deltaTime: number): void {
    if (!this.isPaused) {
      this.timeHours = (this.timeHours + deltaTime * this.timeSpeed) % 24;
    }
    this.updateLighting(deltaTime);
  }

  public setTime(hour: number): void {
    this.timeHours = (hour % 24 + 24) % 24;
    this.updateLighting(0);
  }

  public getFormattedTime(): string {
    const hours = Math.floor(this.timeHours);
    const minutes = Math.floor((this.timeHours % 1) * 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${h12}:${mStr} ${period}`;
  }

  public isNight(): boolean {
    return this.timeHours < 5.5 || this.timeHours > 19.8;
  }

  public isSunset(): boolean {
    return this.timeHours >= 17.5 && this.timeHours <= 19.8;
  }

  private updateLighting(_deltaTime: number): void {
    const t = this.timeHours;

    // Sun orbit trajectory: sunrise at ~6h, noon at 12h, sunset at ~18.5h, night from 20h to 5h
    const sunAngle = ((t - 6) / 24) * Math.PI * 2;
    const sunDistance = 220;
    const sunY = Math.sin(sunAngle) * sunDistance;
    const sunX = Math.cos(sunAngle) * sunDistance;
    const sunZ = Math.sin(sunAngle * 0.5) * 80;

    this.sunLight.position.set(sunX, Math.max(-50, sunY), sunZ);

    let skyColor: THREE.Color;
    let fogColor: THREE.Color;
    let sunColor: THREE.Color;
    let sunIntensity: number;
    let hemiSky: THREE.Color;
    let hemiGround: THREE.Color;
    let neonIntensity: number;

    if (t >= 5 && t < 7) {
      // Dawn / Sunrise: Soft lavender to peach
      const progress = (t - 5) / 2;
      skyColor = new THREE.Color(0x3b1d54).lerp(new THREE.Color(0xfb923c), progress);
      fogColor = new THREE.Color(0x4a2468).lerp(new THREE.Color(0xfbcfe8), progress);
      sunColor = new THREE.Color(0xfdba74);
      sunIntensity = 0.4 + progress * 0.9;
      hemiSky = new THREE.Color(0xf472b6);
      hemiGround = new THREE.Color(0x38bdf8);
      neonIntensity = 1.0 - progress * 0.7;
    } else if (t >= 7 && t < 17) {
      // Daytime: Bright tropical Miami blue & warm golden sunlight
      skyColor = new THREE.Color(0x38bdf8);
      fogColor = new THREE.Color(0xbae6fd);
      sunColor = new THREE.Color(0xfffbeb);
      sunIntensity = 1.8;
      hemiSky = new THREE.Color(0x0284c7);
      hemiGround = new THREE.Color(0x14b8a6);
      neonIntensity = 0.15;
    } else if (t >= 17 && t < 20) {
      // Golden Hour Sunset: Iconic Vice City hot pink, magenta, and amber!
      const progress = (t - 17) / 3;
      skyColor = new THREE.Color(0xf472b6).lerp(new THREE.Color(0x4c1d95), progress);
      fogColor = new THREE.Color(0xfbcfe8).lerp(new THREE.Color(0x2e1065), progress);
      sunColor = new THREE.Color(0xf59e0b).lerp(new THREE.Color(0xef4444), progress);
      sunIntensity = 1.6 - progress * 1.1;
      hemiSky = new THREE.Color(0xf43f5e);
      hemiGround = new THREE.Color(0x06b6d4);
      neonIntensity = 0.3 + progress * 1.5;
    } else {
      // Deep 80s Synth Night: Deep navy/purple atmosphere, glowing neon streets
      skyColor = new THREE.Color(0x0f0728);
      fogColor = new THREE.Color(0x170b3b);
      sunColor = new THREE.Color(0x60a5fa); // Moon light
      sunIntensity = 0.35;
      hemiSky = new THREE.Color(0x7c3aed);
      hemiGround = new THREE.Color(0x06b6d4);
      neonIntensity = 2.0; // Hot neon reflections
    }

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(skyColor);
    } else {
      this.scene.background = skyColor;
    }

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.density = this.isNight() ? 0.0038 : 0.0028;
    }

    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = sunIntensity;
    this.hemiLight.color.copy(hemiSky);
    this.hemiLight.groundColor.copy(hemiGround);
    this.neonFill.intensity = neonIntensity;
  }
}
