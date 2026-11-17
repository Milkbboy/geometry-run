// 플레이 테스트를 위한 임시 밸런스.
export const balance = {
  speed: 240,
  minSpeed: 180,
  maxSpeed: 420,
  gravity: 1500,
  jump: 600,
  playerSize: 36,
  obstacleWidth: 34,
  obstacleHeight: 38,
  gapMin: 390,
  gapMax: 540,
  perfectMs: 60,
  greatMs: 120,
};

export type Grade = 'PERFECT' | 'GREAT' | 'GOOD';

// 점프 궤적과 사각 충돌 영역으로 안전한 이륙 위치를 계산한다.
export function safeWindow(obstacleX: number, speed = balance.speed): { start: number; end: number; target: number } {
  const { gravity, jump, playerSize, obstacleWidth, obstacleHeight } = balance;
  const root = Math.sqrt(jump * jump - 2 * gravity * obstacleHeight);
  const rise = (jump - root) / gravity;
  const fall = (jump + root) / gravity;
  const margin = 5;
  const start = obstacleX + obstacleWidth / 2 + playerSize / 2 - speed * fall + margin;
  const end = obstacleX - obstacleWidth / 2 - playerSize / 2 - speed * rise - margin;
  return { start, end, target: (start + end) / 2 };
}

export function gradeJump(position: number, obstacleX: number, speed = balance.speed): Grade | null {
  const window = safeWindow(obstacleX, speed);
  if (position < window.start || position > window.end)
  {
    // 표시 밖의 점프는 통과해도 타이밍 보상을 주지 않는다.
    return null;
  }
  const differenceMs = Math.abs(position - window.target) / speed * 1000;
  if (differenceMs <= balance.perfectMs)
  {
    return 'PERFECT';
  }
  if (differenceMs <= balance.greatMs)
  {
    return 'GREAT';
  }
  return 'GOOD';
}

export function scaledGap(gap: number, speed: number): number {
  return gap * speed / balance.speed;
}

export function scaledPosition(obstacleX: number, playerX: number, oldSpeed: number, newSpeed: number): number {
  return playerX + (obstacleX - playerX) * newSpeed / oldSpeed;
}

export function points(grade: Grade, combo: number): number {
  const base = { PERFECT: 100, GREAT: 70, GOOD: 40 }[grade];
  return base + Math.min(combo - 1, 10) * 5;
}
