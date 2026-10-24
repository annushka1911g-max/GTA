import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface BuildingInfo {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  name?: string;
  isArtDeco?: boolean;
}

export interface RoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  isMainBoulevard: boolean;
}

export class City {
  public group: THREE.Group;
  public buildings: BuildingInfo[] = [];
  public roads: RoadSegment[] = [];

  private physics: PhysicsWorld;
  private blockSize = 80;
  private roadWidth = 24;
  private gridRadius = 3;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.physics = physics;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.createGroundAndOcean();
    this.generateViceCityGrid();
    this.decorateOceanDrive();
  }

  /**
   * Ground plane, sandy beach strip, and turquoise ocean water
   */
  private createGroundAndOcean(): void {
    const totalSpan = (this.gridRadius * 2 + 3) * this.blockSize;

    // 1. Asphalt Ground Mesh
    const groundGeo = new THREE.PlaneGeometry(totalSpan, totalSpan);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1b1924,
      roughness: 0.85,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.group.add(groundMesh);

    // Physics floor at y = 0
    this.physics.addStaticBox(
      { x: totalSpan, y: 1, z: totalSpan },
      { x: 0, y: -0.5, z: 0 }
    );

    // 2. Sandy Ocean Beach Strip along the East side (X > 160)
    const beachGeo = new THREE.PlaneGeometry(140, totalSpan);
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xfde047, // Golden Miami sand
      roughness: 0.95,
      metalness: 0.05,
    });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(240, 0.06, 0);
    beach.receiveShadow = true;
    this.group.add(beach);

    // 3. Turquoise Ocean Water Mesh
    const oceanGeo = new THREE.PlaneGeometry(280, totalSpan + 100);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Cyan / Turquoise Miami ocean
      metalness: 0.8,
      roughness: 0.15,
      transparent: true,
      opacity: 0.88,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(450, 0.04, 0);
    this.group.add(ocean);
  }

  /**
   * Generates Vice City grid with pastel Art Deco hotels, neon rooftop trims, and Ocean Drive
   */
  private generateViceCityGrid(): void {
    const roadTexture = this.createRoadTexture();
    const roadMaterial = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.8,
      metalness: 0.1,
    });

    const sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbcfe8, // Pastel pink-tinted Miami Art Deco sidewalk!
      roughness: 0.85,
    });

    // Vice City 1980s Pastel Color Palette:
    // Flamingo Pink, Ocean Turquoise, Mint Green, Pale Cream Yellow, Coral, Lilac
    const artDecoColors = [
      0xf472b6, // Flamingo Pink
      0x38bdf8, // Sky Cyan
      0x34d399, // Mint Green
      0xfef08a, // Pastel Yellow
      0xfb7185, // Coral Rose
      0xc084fc, // Lavender Purple
      0xf8fafc, // Pure White Stucco
    ];

    const windowTexture = this.createArtDecoWindowTexture();

    for (let bx = -this.gridRadius; bx <= this.gridRadius; bx++) {
      for (let bz = -this.gridRadius; bz <= this.gridRadius; bz++) {
        const centerX = bx * this.blockSize;
        const centerZ = bz * this.blockSize;

        // Skip building plots on the sandy beach area (X >= 180)
        if (centerX >= 180) continue;

        // Road records for radar
        if (bz < this.gridRadius) {
          this.roads.push({
            x1: centerX,
            z1: centerZ,
            x2: centerX,
            z2: centerZ + this.blockSize,
            width: this.roadWidth,
            isMainBoulevard: bx === 1, // Ocean Drive is bx === 1!
          });
        }
        if (bx < this.gridRadius && centerX + this.blockSize < 180) {
          this.roads.push({
            x1: centerX,
            z1: centerZ,
            x2: centerX + this.blockSize,
            z2: centerZ,
            width: this.roadWidth,
            isMainBoulevard: bz === 0,
          });
        }

        // Sidewalk plot
        const lotSize = this.blockSize - this.roadWidth;
        const sidewalkGeo = new THREE.BoxGeometry(lotSize, 0.25, lotSize);
        const sidewalkMesh = new THREE.Mesh(sidewalkGeo, sidewalkMaterial);
        sidewalkMesh.position.set(centerX, 0.125, centerZ);
        sidewalkMesh.receiveShadow = true;
        this.group.add(sidewalkMesh);

        // Art Deco Hotels along Ocean Drive (bx === 1) or downtown mid-rises
        const isOceanDrive = bx === 1;
        const color = artDecoColors[Math.floor(Math.random() * artDecoColors.length)];

        if (isOceanDrive) {
          // Iconic Art Deco Hotel (Ocean View style: 3-tier stepped facade with glowing neon sign!)
          this.createArtDecoHotel(centerX, centerZ, lotSize * 0.85, lotSize * 0.8, 28, color, windowTexture);
        } else {
          // City blocks: 1 tower or 2 mid-rises
          const bHeight = 22 + Math.random() * 38;
          this.createViceCityBuilding(centerX, centerZ, lotSize * 0.8, lotSize * 0.8, bHeight, color, windowTexture);
        }
      }
    }

    // Add Asphalt road planes
    const totalSpan = (this.gridRadius * 2 + 1) * this.blockSize;

    // Horizontal roads
    for (let bz = -this.gridRadius; bz <= this.gridRadius; bz++) {
      const z = bz * this.blockSize + this.blockSize / 2;
      const roadGeo = new THREE.PlaneGeometry(totalSpan * 0.75, this.roadWidth);
      const roadMesh = new THREE.Mesh(roadGeo, roadMaterial);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(-20, 0.02, z);
      roadMesh.receiveShadow = true;
      this.group.add(roadMesh);
    }

    // Vertical roads (including Ocean Drive along X = 120)
    for (let bx = -this.gridRadius; bx <= this.gridRadius; bx++) {
      const x = bx * this.blockSize + this.blockSize / 2;
      if (x > 180) continue;
      const roadGeo = new THREE.PlaneGeometry(this.roadWidth, totalSpan + this.roadWidth);
      const roadMesh = new THREE.Mesh(roadGeo, roadMaterial);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(x, 0.03, 0);
      roadMesh.receiveShadow = true;
      this.group.add(roadMesh);
    }
  }

  /**
   * Art Deco Hotel with stepped facade, neon rooftop sign and glowing pink/cyan fins
   */
  private createArtDecoHotel(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    color: number,
    windowMap: THREE.CanvasTexture
  ): void {
    const group = new THREE.Group();

    // Main Body
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.45,
      map: windowMap,
    });
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mainBody.position.y = height / 2 + 0.25;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    group.add(mainBody);

    // Stepped Upper Tier
    const tierH = 6;
    const tierGeo = new THREE.BoxGeometry(width * 0.7, tierH, depth * 0.7);
    const tier = new THREE.Mesh(tierGeo, mat);
    tier.position.set(0, height + tierH / 2 + 0.25, 0);
    group.add(tier);

    // Glowing Neon Rooftop Trim (Hot Pink)
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const trimF = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.3, 0.3), neonMat);
    trimF.position.set(0, height + tierH + 0.3, depth * 0.35);
    group.add(trimF);

    // Central Art Deco Spire with Cyan Neon
    const spireMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 7, 8), spireMat);
    spire.position.set(0, height + tierH + 3.8, 0);
    group.add(spire);

    // Front Neon Hotel Signboard ("OCEAN VIEW" / "VICE")
    const signMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, 1.6, 0.2), signMat);
    sign.position.set(0, height * 0.7, depth / 2 + 0.15);
    group.add(sign);

    group.position.set(x, 0, z);
    this.group.add(group);

    // Physical collider
    this.physics.addStaticBox(
      { x: width, y: height + tierH, z: depth },
      { x, y: (height + tierH) / 2, z }
    );

    this.buildings.push({
      x,
      z,
      width,
      depth,
      height: height + tierH,
      color,
      isArtDeco: true,
    });
  }

  private createViceCityBuilding(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    color: number,
    windowMap: THREE.CanvasTexture
  ): void {
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.5,
      map: windowMap,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.y = height / 2 + 0.25;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Neon edge trim
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.25, depth + 0.2), neonCyan);
    roofTrim.position.set(0, height + 0.35, 0);
    group.add(roofTrim);

    group.position.set(x, 0, z);
    this.group.add(group);

    this.physics.addStaticBox(
      { x: width, y: height, z: depth },
      { x, y: height / 2 + 0.25, z }
    );

    this.buildings.push({ x, z, width, depth, height, color });
  }

  /**
   * Decorate Ocean Drive beachfront boulevard with dense tropical palms and glowing pastel lamps
   */
  private decorateOceanDrive(): void {
    const palm = this.createViceCityPalm();

    // Plant dense rows of tropical palm trees along Ocean Drive (X = 140 to 170)
    for (let z = -240; z <= 240; z += 18) {
      // Boulevard sidewalk palm
      const p1 = palm.clone();
      p1.position.set(135, 0.25, z);
      p1.rotation.y = Math.random() * Math.PI * 2;
      const s1 = 0.9 + Math.random() * 0.3;
      p1.scale.set(s1, s1, s1);
      this.group.add(p1);

      // Beachside promenade palm
      const p2 = palm.clone();
      p2.position.set(170, 0.1, z + 9);
      p2.rotation.y = Math.random() * Math.PI * 2;
      const s2 = 1.0 + Math.random() * 0.35;
      p2.scale.set(s2, s2, s2);
      this.group.add(p2);
    }

    // Street lamps along the boulevard with warm pink/cyan glow
    for (let z = -220; z <= 220; z += 40) {
      this.createViceCityStreetLamp(132, z);
      this.createViceCityStreetLamp(68, z);
    }
  }

  private createViceCityStreetLamp(x: number, z: number): void {
    const lamp = new THREE.Group();

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.8, roughness: 0.2 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8), poleMat);
    pole.position.y = 3.75;
    lamp.add(pole);

    // Curved pastel arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), poleMat);
    arm.position.set(0.8, 7.4, 0);
    lamp.add(arm);

    // Glowing pink/amber lantern
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), bulbMat);
    bulb.position.set(1.6, 7.2, 0);
    lamp.add(bulb);

    lamp.position.set(x, 0.25, z);
    this.group.add(lamp);

    this.physics.addStaticBox({ x: 0.35, y: 7.5, z: 0.35 }, { x, y: 3.75, z });
  }

  private createViceCityPalm(): THREE.Group {
    const palm = new THREE.Group();

    // Trunk
    const trunkCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.3, 4.5, 0),
      new THREE.Vector3(-0.4, 9, 0),
      new THREE.Vector3(0.2, 13, 0)
    );
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 14, 0.35, 8, false);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    palm.add(trunk);

    // Vibrant Green/Turquoise Fronds
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Lush tropical green
      roughness: 0.7,
      side: THREE.DoubleSide,
    });

    const frondCount = 10;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i / frondCount) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(0.9, 5.0, 5);
      frondGeo.translate(0, 2.5, 0);
      frondGeo.rotateX(Math.PI / 2.8);

      const frondMesh = new THREE.Mesh(frondGeo, frondMat);
      frondMesh.position.set(0.2, 13, 0);
      frondMesh.rotation.y = angle;
      frondMesh.castShadow = true;
      palm.add(frondMesh);
    }

    return palm;
  }

  private createRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e1c26';
    ctx.fillRect(0, 0, 512, 512);

    // Double yellow center divider
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 252);
    ctx.lineTo(512, 252);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 260);
    ctx.lineTo(512, 260);
    ctx.stroke();

    // White dashed outer lane lines
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 22]);

    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(512, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 384);
    ctx.lineTo(512, 384);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 1);
    return texture;
  }

  private createArtDecoWindowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#181226';
    ctx.fillRect(0, 0, 256, 256);

    const rows = 12;
    const cols = 12;
    const cellW = 256 / cols;
    const cellH = 256 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rand = Math.random();
        if (rand > 0.4) {
          ctx.fillStyle = rand > 0.7 ? '#fef08a' : '#00f0ff';
        } else {
          ctx.fillStyle = '#261b3b';
        }
        ctx.fillRect(c * cellW + 3, r * cellH + 3, cellW - 6, cellH - 6);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 6);
    return texture;
  }
}
