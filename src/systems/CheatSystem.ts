import { AudioManager } from '../audio/AudioManager';

export interface CheatHandler {
  code: string;
  name: string;
  description: string;
  action: () => void;
}

export class CheatSystem {
  private audio: AudioManager;
  private inputBuffer: string = '';
  private maxBufferLen = 25;
  private cheats: Map<string, CheatHandler> = new Map();
  private onCheatActivatedCallback?: (name: string, description: string) => void;

  constructor(audio: AudioManager) {
    this.audio = audio;
    this.setupKeyListener();
  }

  public registerCheat(code: string, name: string, description: string, action: () => void): void {
    this.cheats.set(code.toUpperCase(), { code: code.toUpperCase(), name, description, action });
  }

  public setOnCheatActivated(cb: (name: string, desc: string) => void): void {
    this.onCheatActivatedCallback = cb;
  }

  public triggerCheatDirectly(code: string): boolean {
    const handler = this.cheats.get(code.toUpperCase());
    if (handler) {
      handler.action();
      this.audio.playCheatActivated();
      if (this.onCheatActivatedCallback) {
        this.onCheatActivatedCallback(handler.name, handler.description);
      }
      return true;
    }
    return false;
  }

  public getRegisteredCheats(): CheatHandler[] {
    return Array.from(this.cheats.values());
  }

  private setupKeyListener(): void {
    window.addEventListener('keydown', (e) => {
      // Only process letter keys
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        this.inputBuffer += e.key.toUpperCase();
        if (this.inputBuffer.length > this.maxBufferLen) {
          this.inputBuffer = this.inputBuffer.slice(-this.maxBufferLen);
        }
        this.checkCheats();
      }
    });
  }

  private checkCheats(): void {
    for (const [code, handler] of this.cheats.entries()) {
      if (this.inputBuffer.endsWith(code)) {
        // Execute cheat
        handler.action();
        this.audio.playCheatActivated();

        if (this.onCheatActivatedCallback) {
          this.onCheatActivatedCallback(handler.name, handler.description);
        }

        // Clear buffer so it doesn't re-trigger immediately
        this.inputBuffer = '';
        break;
      }
    }
  }
}
