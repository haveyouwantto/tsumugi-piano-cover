// @maple-kaede/picoaudio (author: Maple-Kaede さんの PicoAudio.js の fork) には型が付いていない
declare module "@maple-kaede/picoaudio" {
  export interface PicoAudioOptions {
    debug?: boolean;
    audioContext?: AudioContext;
    picoAudio?: unknown;
  }

  export default class PicoAudio {
    constructor(options?: PicoAudioOptions);
    init(): void;
    parseSMF(data: Uint8Array): unknown;
    setData(parsed: unknown): void;
    play(isLoop?: boolean): void;
    pause(): void;
    initStatus(): void;
    setStartTime(seconds: number): void;
    setMasterVolume(volume: number): void;
    getMasterVolume(): number;
    setLoop(enable: boolean): void;
    isLoop(): boolean;
    setReverb(enable: boolean): void;
    setReverbVolume(volume: number): void;
    getTime(tick: number): number;
    addEventListener(type: "play" | "pause" | "songEnd", listener: () => void): void;
    removeAllEventListener(type: "play" | "pause" | "noteOn" | "noteOff" | "songEnd"): void;
  }
}
