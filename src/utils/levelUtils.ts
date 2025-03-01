export function calculateLevel(xp: number): number {
  // Using modified Pokemon algorithm: Level = (XP/0.8)^(1/3)
  return Math.floor(Math.pow(xp / 0.8, 1/3));
}

export function calculateXpForLevel(level: number): number {
  // Reverse of above formula: XP = 0.8 * level^3
  return Math.floor(0.8 * Math.pow(level, 3));
}

export const XP_PER_BONK = 50; // Adjust this value to tune progression speed 