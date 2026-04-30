import type { SignalDeviceScoreBoundaries, SignalDeviceTier } from '@stroma-labs/signal-contracts';
import { DEFAULT_DEVICE_SCORE_BOUNDARIES } from '@stroma-labs/signal-contracts';

export { DEFAULT_DEVICE_SCORE_BOUNDARIES };

export interface DeviceSnapshot {
  device_tier: SignalDeviceTier;
  device_cores: number;
  device_memory_gb: number | null;
  device_screen_w: number;
  device_screen_h: number;
}

function scoreCores(cores: number, boundaries: SignalDeviceScoreBoundaries['cores']): number {
  if (cores <= boundaries.low) return 0;
  if (cores <= boundaries.mid) return 1;
  if (cores <= boundaries.high) return 2;
  return 3;
}

function scoreMemory(memory: number | null, boundaries: SignalDeviceScoreBoundaries['memory_gb']): number | null {
  if (memory == null) return null;
  if (memory <= boundaries.low) return 0;
  if (memory <= boundaries.mid) return 1;
  if (memory <= boundaries.high) return 2;
  return 3;
}

function scoreScreen(width: number, boundaries: SignalDeviceScoreBoundaries['screen_w']): number {
  if (width < boundaries.mobile) return 0;
  if (width < boundaries.tablet) return 1;
  if (width < boundaries.desktop) return 2;
  return 3;
}

export function defaultDeviceTier(
  cores: number,
  memory: number | null,
  screenWidth: number,
  boundaries: SignalDeviceScoreBoundaries = DEFAULT_DEVICE_SCORE_BOUNDARIES
): SignalDeviceTier {
  const scores = [scoreCores(cores, boundaries.cores), scoreScreen(screenWidth, boundaries.screen_w)];
  const memoryScore = scoreMemory(memory, boundaries.memory_gb);
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
  const memory =
    typeof globalThis.navigator !== 'undefined'
      ? ((globalThis.navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null)
      : null;
  const screenWidth = globalThis.screen?.width ?? 0;
  const screenHeight = globalThis.screen?.height ?? 0;

  const device_tier = override ? override(cores, memory, screenWidth) : defaultDeviceTier(cores, memory, screenWidth);

  return {
    device_tier,
    device_cores: cores,
    device_memory_gb: memory,
    device_screen_w: screenWidth,
    device_screen_h: screenHeight
  };
}
