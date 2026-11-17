import { describe, expect, it } from 'vitest';
import { balance, gradeJump, points, safeWindow, scaledGap, scaledPosition } from './rules';

describe('점프 판정과 점수', () => {
  it('안전 구간과 등급 경계를 구분한다', () => {
    const window = safeWindow(850);
    expect(window.start).toBeLessThan(window.target);
    expect(window.target).toBeLessThan(window.end);
    expect(gradeJump(window.start - 1, 850)).toBeNull();
    expect(gradeJump(window.target, 850)).toBe('PERFECT');
    expect(gradeJump(window.target + balance.speed * 0.08, 850)).toBe('GREAT');
    expect(gradeJump(window.end, 850)).toBe('GOOD');
  });
  it('콤보 보너스에 상한을 적용한다', () => {
    expect(points('PERFECT', 1)).toBe(100);
    expect(points('GREAT', 3)).toBe(80);
    expect(points('GOOD', 20)).toBe(90);
  });
  it('표시 구간 양 끝에서 장애물과 충돌하지 않는다', () => {
    const obstacleX = 850;
    for (let speed = balance.minSpeed; speed <= balance.maxSpeed; speed += 5)
    {
      const window = safeWindow(obstacleX, speed);
      expect(window.start).toBeLessThan(window.end);
      for (let x = window.start; x <= window.end; x += 1)
      {
        let height = 0;
        let velocity = balance.jump;
        let playerX = x;
        for (let tick = 0; tick < 100; tick++)
        {
          playerX += speed / 120;
          velocity -= balance.gravity / 120;
          height = Math.max(0, height + velocity / 120);
          const overlapping = Math.abs(playerX - obstacleX) < (balance.playerSize + balance.obstacleWidth) / 2;
          expect(overlapping && height < balance.obstacleHeight).toBe(false);
        }
      }
    }
  });
  it('속도 변경 전후 장애물까지 걸리는 시간과 간격을 유지한다', () => {
    for (const speed of [balance.minSpeed, balance.speed, balance.maxSpeed])
    {
      expect(scaledGap(balance.gapMin, speed) / speed).toBeCloseTo(balance.gapMin / balance.speed);
      expect((scaledPosition(900, 200, balance.speed, speed) - 200) / speed).toBeCloseTo(700 / balance.speed);
    }
  });
});
