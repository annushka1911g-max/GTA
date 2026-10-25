<div align="center">

# 🌴 Grand Theft Auto: Vice City — 3D Web Remaster

### *A High-Performance WebGL 3D Open-World Action Simulation Powered by Three.js & Cannon-es*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript&style=for-the-badge)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black.svg?logo=three.js&style=for-the-badge)](https://threejs.org/)
[![Cannon-es](https://img.shields.io/badge/Cannon--es-0.20-red.svg?style=for-the-badge)](https://pmndrs.github.io/cannon-es/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg?logo=vite&style=for-the-badge)](https://vitejs.dev/)
[![WebGL 2](https://img.shields.io/badge/WebGL-2.0-orange.svg?style=for-the-badge)](https://www.khronos.org/webgl/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[**Live Demo**](http://localhost:5173) • [**Architecture**](#-technical-architecture) • [**Vehicle Physics**](#-raycast-vehicle-physics) • [**Combat System**](#-combat--weapons-arsenal) • [**Controls**](#-controls-reference) • [**Installation**](#-installation--setup)

---

</div>

## 📖 Executive Summary

**Grand Theft Auto: Vice City — 3D Web Remaster** is a browser-native re-engineering of the iconic 1986 Miami open-world experience. Built strictly from the ground up without heavy game engines, it leverages modern **Three.js** hardware-accelerated WebGL rendering, **Cannon-es** rigid-body and raycast vehicle physics, and a **zero-dependency procedural Web Audio API** synthesis engine for dynamic V8 engine audio, sirens, and 80s synthwave radio.

Explore Ocean Drive, hijack legendary supercars like the *Infernus* and *Cheetah*, initiate high-angle power-slide drifts with real-time tire smoke, execute melee combos as Tommy Vercetti, and navigate the city via a real-time rotating radar HUD.

---

## 📸 Key Features at a Glance

| Feature Category | Highlights |
|---|---|
| **🌆 World & Environment** | Ocean Drive boulevard, Art Deco hotels with neon signs, sandy Miami beach, ocean plane, swaying tropical palms, golden hour sunset lighting. |
| **🚶 Tommy Vercetti Rig** | Multi-joint skeletal hierarchy, Hawaiian turquoise palm shirt, dark slicked hair, gold chain, shoulder swagger walk, athletic sprint, jumping squash/stretch. |
| **🏎️ Raycast Vehicle Dynamics** | 4-wheel independent spring suspension, anti-roll stabilization, progressive steering return, handbrake drift mechanics, functional headlights & reactive brake taillights. |
| **🏏 Combat & Weaponry** | 3-tier weapon arsenal (Fists, Baseball Bat, Colt .45 Pistol), 3-hit melee combo (Jab $\rightarrow$ Cross $\rightarrow$ Hook), muzzle flash illumination, audio thuds. |
| **🗺️ Vice City Radar HUD** | Circular real-time overhead canvas minimap, compass orientation, color-coded vehicle blips, hot pink health & cyan armor status meters, digital speedometer. |
| **📻 Procedural Audio Engine** | Pure Web Audio synthesis: speed/RPM modulated V8 engine, dual-tone horn, VCPD siren wail, tire screech, and 80s synth stations (*Flash FM*, *Wave 103*, *Fever 105*). |

---

## 🏗️ Technical Architecture

The engine runs on a deterministic fixed-step physics tick decoupled from the render loop to ensure smooth framerates even during high-velocity collisions.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MAIN ENGINE LOOP                                │
│                     (requestAnimationFrame / delta time)                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│        INPUT SUBSYSTEM        │               │       PHYSICS SUBSYSTEM       │
│  - Keyboard Listener (WASD)   │               │  - Cannon.js World (Gravity)  │
│  - Pointer Lock Mouse Orbit   │──────────────►│  - SAPBroadphase Collision    │
│  - Weapon Selector (1 / 2 / 3)│               │  - Sub-stepped Solver (60Hz)  │
│  - Proximity Check (Hijack F) │               │  - Material Contact Friction  │
└───────────────────────────────┘               └───────────────┬───────────────┘
                                                                │
            ┌───────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GAMEPLAY LOGIC & ENTITIES                         │
│  ┌───────────────────────────┐             ┌──────────────────────────────┐ │
│  │     TOMMY VERCETTI        │             │    RAYCAST VEHICLE FLEET     │ │
│  │  - Kinematic Pelvis/Torso │             │  - Infernus, Cheetah, Cruiser│ │
│  │  - Swagger & Sprint Walk  │◄───────────►│  - Independent 4-Wheel Rays  │ │
│  │  - 3-Hit Punch & Recoil   │   (Hijack)  │  - Anti-Roll Bar Torque      │ │
│  │  - Weapon Attachments     │             │  - Handbrake Power-Slide     │ │
│  └───────────────────────────┘             └──────────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│       RENDER SUBSYSTEM        │               │        AUDIO SUBSYSTEM        │
│  - Three.js WebGL2 Pipeline   │               │  - Web Audio Context          │
│  - ACES Filmic Tone Mapping   │               │  - Dual Oscillator V8 Engine  │
│  - Directional Sun & PCF Soft │               │  - Bandpass Tire Skid Noise   │
│  - Stepped Art Deco & Palms   │               │  - 80s Synth FM Radio Tracker │
│  - 2D Canvas Minimap HUD      │               │  - VCPD Swept Siren Generator │
└───────────────────────────────┘               └───────────────────────────────┘
```

---

## 🏎️ Raycast Vehicle Physics

Unlike simple box colliders that stick or tumble unnaturally, vehicles in this remaster utilize `CANNON.RaycastVehicle`:

$$F_{\text{suspension}} = k \cdot (L_{\text{rest}} - L_{\text{current}}) - c \cdot v_{\text{wheel}}$$

- **Suspension Springs**: Tuned stiffness ($k = 32$) and relaxation damping ($c = 2.4$) for road adherence over sidewalks and curbs.
- **Speed-Sensitive Steering**: Steering angle attenuates at high speeds to prevent rollover while preserving tight maneuvering in alleyways:
  $$\theta_{\text{steer}} = \theta_{\text{max}} \cdot \max\left(0.38, 1 - \frac{v_{\text{mph}}}{125}\right)$$
- **Active Anti-Roll Stabilization**: When chassis roll angle exceeds $0.05 \text{ rad}$, a corrective counter-torque is injected into the rigid body's inertia tensor to suppress rollovers.
- **Power-Slide Drifting**: Engaging the handbrake (<kbd>Space</kbd>) locks the rear axle, reduces the rear wheel friction slip coefficient ($\mu_{\text{slip}}$ from $2.8 \rightarrow 0.9$), and engages tire smoke emission.

---

## 🥊 Combat & Weapons Arsenal

Tommy Vercetti features dynamic weapon attachment mounts, procedural upper-body recoil, and audio feedback:

```
[1] 👊 FISTS           - 3-Step Dynamic Combo (Left Jab -> Right Cross -> Heavy Hook)
[2] 🏏 BASEBALL BAT    - 180° Torso Arc Cleave with Metallic Resonance
[3] 🔫 COLT .45 PISTOL - Muzzle Flash Dynamic Light, Slide Recoil, Ballistic Trajectory
```

Weapon selection can be triggered seamlessly via keys <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>, mouse wheel scrolling, or directly clicking the bottom HUD quick-switch dock.

---

## 📻 Procedural 80s Audio Synthesis

Zero external audio files are required. All sound is synthesized mathematically in real time via the Web Audio API:

1. **V8 Engine Combustion**:
   - Primary Sawtooth Oscillator (base frequency $48\text{ Hz} \rightarrow 170\text{ Hz}$ across 6 simulated gears).
   - Sub-Harmonic Triangle Oscillator ($f / 2$) for low-end chassis rumble.
   - Dynamic 2nd-order Lowpass Filter ($Q = 2.5$) opening proportionally under throttle demand.
2. **80s Synthwave Radio**:
   - **FLASH FM**: 80s Synth-pop ($F \rightarrow G \rightarrow Em \rightarrow Am$ progression with Roland Juno chorus and 808 gated kicks).
   - **WAVE 103**: Minor darkwave / new wave ($Dm \rightarrow Bb \rightarrow C \rightarrow Am$ sawtooth arpeggiations).
   - **FEVER 105**: Miami disco/funk ($Em7 \rightarrow A7 \rightarrow D\text{maj}7 \rightarrow Bm7$ slap-bass chords).
3. **VCPD Emergency Siren**: Dual-frequency triangular frequency sweep ($650\text{ Hz} \leftrightarrow 920\text{ Hz}$) toggled on <kbd>H</kbd>.

---

## 🎮 Controls Reference

### 🌴 On-Foot Controls (Tommy Vercetti)
| Action | Key / Input |
|---|---|
| **Movement** | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> |
| **Sprint** | <kbd>Left Shift</kbd> (Depletes Stamina) |
| **Jump** | <kbd>Space</kbd> |
| **Hijack / Enter Nearby Car** | <kbd>F</kbd> or <kbd>Enter</kbd> (when door prompt is visible) |
| **Attack / Fire Weapon** | <kbd>Left Mouse Click</kbd> |
| **Aim Stance** | <kbd>Right Mouse Click</kbd> (Tightens Crosshair) |
| **Switch Weapons** | <kbd>1</kbd> (Fists), <kbd>2</kbd> (Bat), <kbd>3</kbd> (Colt .45) or <kbd>Scroll Wheel</kbd> |
| **360° Free Camera Orbit** | <kbd>Mouse Move</kbd> (Click canvas for Pointer Lock) |
| **Camera Distance** | <kbd>C</kbd> (Close / Medium / Wide) |
| **Controls Help Overlay** | <kbd>H</kbd> or <kbd>Tab</kbd> |

### 🏎️ Vehicle Controls (Driving)
| Action | Key / Input |
|---|---|
| **Throttle / Accelerate** | <kbd>W</kbd> or <kbd>Up Arrow</kbd> |
| **Foot Brake & Reverse** | <kbd>S</kbd> or <kbd>Down Arrow</kbd> |
| **Steer Left / Right** | <kbd>A</kbd> / <kbd>D</kbd> or <kbd>Left</kbd> / <kbd>Right</kbd> |
| **Handbrake / Power-Slide Drift** | <kbd>Space</kbd> |
| **Exit Vehicle** | <kbd>F</kbd> |
| **Horn / VCPD Police Siren** | <kbd>H</kbd> |
| **Cycle Radio Stations** | <kbd>Q</kbd> (Previous) / <kbd>E</kbd> (Next) |
| **Flip Vehicle Upright** | <kbd>R</kbd> (Resets chassis orientation & velocity) |
| **Chase Camera Mode** | <kbd>C</kbd> |

---

## 📁 Repository Structure

```
gta/
├── index.html                  # Main entry point with Vice City HUD, radar & overlays
├── package.json                # Project dependencies & scripts
├── tsconfig.json               # TypeScript compiler configuration
├── src/
│   ├── main.ts                 # Engine initialization, game loop, lighting & inputs
│   ├── style.css               # Neon Vice City CSS design system & HUD overlays
│   ├── audio/
│   │   └── AudioManager.ts     # Procedural Web Audio API sound synthesizer
│   ├── entities/
│   │   ├── Player.ts           # Tommy Vercetti multi-joint rig, animations & weapons
│   │   └── Vehicle.ts          # Raycast vehicle physics, drifting & 3D body styles
│   ├── physics/
│   │   └── PhysicsWorld.ts     # Cannon-es physics world & collision materials
│   ├── ui/
│   │   └── HUD.ts              # 2D canvas radar minimap, speedometer & meters
│   └── world/
│       └── City.ts             # Procedural Ocean Drive, Art Deco hotels & palms
└── dist/                       # Optimized production distribution bundle
```

---

## 💻 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (version `v18.0.0` or higher recommended)
- `npm` or `pnpm`

### 1. Clone the Repository
```bash
git clone https://github.com/annushka1911g-max/GTA.git
cd GTA
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Navigate your browser to **`http://localhost:5173`**, click **START GAME**, and enjoy!

### 4. Build Production Bundle
```bash
npm run build
```
The optimized bundle will be compiled to the `dist/` directory.

---

## 🛣️ Roadmap & Milestones

- [x] Full player anatomical rig & procedural swagger animations (walk, sprint, jump, aim, 3-hit combo)
- [x] Raycast vehicle suspension physics with anti-roll bar and handbrake power-slide drifting
- [x] Authentic 80s Miami Ocean Drive, Art Deco hotels, neon signs & sandy beach
- [x] Procedural Web Audio engine & 80s synth radio stations (*Flash FM*, *Wave 103*, *Fever 105*)
- [x] Real-time circular radar minimap HUD with compass, road paths, and waypoint tracking
- [x] Pedestrian AI system with sidewalk navigation graph, crowd panic, combat reactions, and knockout cash drops
- [x] Autonomous traffic vehicle AI with lane following, collision avoidance, and seamless carjacking
- [x] Police pursuit & 5-Star Wanted System with siren wailing, high-speed ramming, BUSTED arrest and WASTED recovery
- [x] Reusable Mission framework with 3 complete playable original missions (*The First Delivery*, *Coastal Getaway*, *Night Shift*)
- [x] 24-Hour dynamic Day/Night cycle with sunset, sunrise, midday tropical sun, and glowing neon night
- [x] 3D rotating collectible pickups (Cash briefcases, Health hearts, Armor shields, Ammunition boxes)
- [x] Persistent Save/Load system (`SaveManager`) with auto-save and reset
- [x] In-game Pause menu (`ESC`) with resume, save game, controls guide, and time-of-day selector
- [ ] Drivable motorcycles and speedboats
- [ ] Additional city districts (Airport, Industrial Docks, Golf Club)

---

## 📄 License & Credits

This project is released under the **[MIT License](LICENSE)**. 

*Inspired by the atmosphere, aesthetic, and gameplay systems of classic 1980s Miami open-world action games. Built strictly as an independent, original WebGL simulation.*
