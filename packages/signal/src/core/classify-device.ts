import type { SignalDeviceTier } from '@stroma-labs/signal-contracts';

export interface DeviceSnapshot {
  device_tier: SignalDeviceTier;
  device_cores: number;
  device_memory_gb: number | null;
  device_screen_w: number;
  device_screen_h: number;
}

function scoreCores(cores: number): number {
  if (cores <= 2) return 0;
  if (cores <= 4) return 1;
  if (cores <= 6) return 2;
  return 3;
}

function scoreMemory(memory: number | null): number | null {
  if (memory == null) return null;
  if (memory <= 1) return 0;
  if (memory <= 2) return 1;
  if (memory <= 4) return 2;
  return 3;
}

function scoreScreen(width: number): number {
  if (width < 480) return 0;
  if (width < 768) return 1;
  if (width < 1280) return 2;
  return 3;
}

export function defaultDeviceTier(
  cores: number,
  memory: number | null,
  screenWidth: number
): SignalDeviceTier {
  const scores = [scoreCores(cores), scoreScreen(screenWidth)];
  const memoryScore = scoreMemory(memory);
  if (memoryScore != null) scores.push(memoryScore);

  const total = scores.reduce((sum, score) => sum + score, 0);
  const max = scores.length * 3;

  if (total <= Math.floor(max / 3)) return 'low';
  if (total <= Math.floor((max * 2) / 3)) return 'mid';
  return 'high';
}

export function classifyDevice(
  override?: (cores: number, memory: number | null, screenWidth: number) => SignalDeviceTier
): DeviceSnapshot {
  const cores = globalThis.navigator?.hardwareConcurrency ?? 1;
  const memory = typeof globalThis.navigator !== 'undefined'
    ? ((globalThis.navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null)
    : null;
  const screenWidth = globalThis.screen?.width ?? 0;
  const screenHeight = globalThis.screen?.height ?? 0;

  const device_tier = override
    ? override(cores, memory, screenWidth)
    : defaultDeviceTier(cores, memory, screenWidth);

  return {
    device_tier,
    device_cores: cores,
    device_memory_gb: memory,
    device_screen_w: screenWidth,
    device_screen_h: screenHeight
  };
}
