import { describe, expect, it } from 'vitest';
import { balance, gradeJump, points, safeWindow } from './rules';

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
    const window = safeWindow(obstacleX);
    for (let x = window.start; x <= window.end; x += 0.5)
    {
      for (let t = 0; t <= 0.8; t += 1 / 120)
      {
        const playerX = x + balance.speed * t;
        const height = Math.max(0, balance.jump * t - balance.gravity * t * t / 2);
        const overlapping = Math.abs(playerX - obstacleX) < (balance.playerSize + balance.obstacleWidth) / 2;
        expect(overlapping && height < balance.obstacleHeight).toBe(false);
      }
    }
  });
});
