import { WeaponType } from '../entities/Player';

export interface GameSaveData {
  version: number;
  cash: number;
  health: number;
  armor: number;
  stamina: number;
  position: { x: number; y: number; z: number };
  completedMissions: string[];
  activeMissionId: string | null;
  currentWeapon: WeaponType;
  pistolAmmo: number;
  shotgunAmmo: number;
  smgAmmo: number;
  m4Ammo: number;
  rpgAmmo: number;
  grenadeCount: number;
  settings: {
    soundVolume: number;
    radioVolume: number;
    mouseSensitivity: number;
    dayNightSpeed: number;
  };
}

const STORAGE_KEY = 'vice_city_game_save_v1';

export class SaveManager {
  private static defaultData: GameSaveData = {
    version: 1,
    cash: 2500,
    health: 100,
    armor: 100,
    stamina: 100,
    position: { x: 0, y: 1.5, z: 5 },
    completedMissions: [],
    activeMissionId: null,
    currentWeapon: 'fists',
    pistolAmmo: 60,
    shotgunAmmo: 35,
    smgAmmo: 150,
    m4Ammo: 200,
    rpgAmmo: 10,
    grenadeCount: 8,
    settings: {
      soundVolume: 0.8,
      radioVolume: 0.7,
      mouseSensitivity: 1.0,
      dayNightSpeed: 1.0,
    },
  };

  public static load(): GameSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...this.defaultData };
      const parsed = JSON.parse(raw) as Partial<GameSaveData>;
      return {
        ...this.defaultData,
        ...parsed,
        settings: {
          ...this.defaultData.settings,
          ...(parsed.settings || {}),
        },
      };
    } catch (err) {
      console.warn('Failed to load save from localStorage, reverting to defaults:', err);
      return { ...this.defaultData };
    }
  }

  public static save(data: GameSaveData): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('Failed to write save data to localStorage:', err);
      return false;
    }
  }

  public static reset(): GameSaveData {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Could not remove save key:', err);
    }
    return { ...this.defaultData };
  }
}
