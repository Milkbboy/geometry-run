import Phaser from 'phaser';
import { balance, gradeJump, points, safeWindow, scaledGap, scaledPosition, type Grade } from './rules';
import './style.css';

const W = 960;
const H = 540;
const ground = 425;
const playerScreenX = 190;
const step = 1 / 120;
type Obstacle = { x: number; grade: Grade | null; checked: boolean };

document.querySelector<HTMLDivElement>('#game')!.innerHTML = `
  <div id="canvas"></div>
  <div class="hud"><div><small>점수</small><strong id="score">0</strong></div><div><small>콤보</small><strong id="combo">0</strong></div><button id="pause" aria-label="일시정지">Ⅱ</button></div>
  <div class="speed-control"><label for="speed">속도 <strong id="speed-value">보통 · 1.00×</strong></label><input id="speed" type="range" min="180" max="420" step="5" value="240" aria-label="달리기 속도"><div class="speed-labels"><span>느림</span><span>보통</span><span>빠름</span></div></div>
  <div id="message" class="message"></div>
  <div id="overlay" class="overlay"><div class="card"><div class="eyebrow">READY, SET, JUMP!</div><h1>Geometry <span>Run</span></h1><p>바닥의 빛이 발밑에 오면 점프!<br>꾹 누르면 착지할 때마다 다시 뛰어요.</p><button id="start" class="primary">시작하기 <span>→</span></button><small>화면 터치 · 스페이스바</small></div></div>`;

const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const scoreEl = document.querySelector<HTMLElement>('#score')!;
const comboEl = document.querySelector<HTMLElement>('#combo')!;
const message = document.querySelector<HTMLElement>('#message')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const speedInput = document.querySelector<HTMLInputElement>('#speed')!;
const speedValue = document.querySelector<HTMLElement>('#speed-value')!;

class RunScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private x = 0;
  private height = 0;
  private velocity = 0;
  private accumulator = 0;
  private obstacles: Obstacle[] = [];
  private held = false;
  private running = false;
  private started = false;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private perfects = 0;
  private feedbackUntil = 0;
  private speed: number = balance.speed;
  private requestedSpeed: number = balance.speed;

  constructor() { super('run'); }

  create(): void {
    this.graphics = this.add.graphics();
    this.input.on('pointerdown', () => { this.held = true; this.tryJump(); });
    this.input.on('pointerup', () => { this.held = false; });
    this.input.on('pointerupoutside', () => { this.held = false; });
    this.input.keyboard!.on('keydown-SPACE', (event: KeyboardEvent) => {
      event.preventDefault();
      if (!event.repeat)
      {
        this.held = true;
        this.tryJump();
      }
    });
    this.input.keyboard!.on('keyup-SPACE', () => { this.held = false; });
    document.querySelector<HTMLButtonElement>('#start')!.addEventListener('click', () => this.startRun());
    pauseButton.addEventListener('click', () => this.pauseRun());
    speedInput.addEventListener('input', () => {
      this.requestedSpeed = Number(speedInput.value);
      if (!this.running)
      {
        this.applySpeed();
      }
      this.updateSpeedLabel();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden)
      {
        this.pauseRun();
      }
    });
    this.draw();
  }

  private startRun(): void {
    this.x = 0;
    this.height = 0;
    this.velocity = 0;
    this.accumulator = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.perfects = 0;
    this.held = false;
    this.speed = this.requestedSpeed;
    this.updateSpeedLabel();
    this.obstacles = [{ x: scaledGap(850, this.speed), grade: null, checked: false }];
    this.started = true;
    this.running = true;
    this.updateHud();
    overlay.classList.add('hidden');
    message.textContent = '';
  }

  private pauseRun(): void {
    if (!this.running)
    {
      // 메뉴와 결과 화면에서는 일시정지할 게임이 없다.
      return;
    }
    this.running = false;
    this.held = false;
    this.accumulator = 0;
    overlay.innerHTML = `<div class="card"><div class="eyebrow">TAKE A BREATH</div><h1>잠깐 쉬어가요</h1><p>준비되면 다시 달려볼까요?</p><button class="primary" id="resume">계속하기 <span>→</span></button></div>`;
    overlay.classList.remove('hidden');
    document.querySelector<HTMLButtonElement>('#resume')!.onclick = () => {
      overlay.classList.add('hidden');
      this.running = true;
    };
  }

  private tryJump(): void {
    if (!this.running || this.height > 0)
    {
      // 공중 입력은 착지할 때까지 기다린다.
      return;
    }
    this.velocity = balance.jump;
    const next = this.obstacles.find(item => !item.checked && item.x > this.x);
    if (next)
    {
      next.grade = gradeJump(this.x, next.x, this.speed);
    }
  }

  update(_time: number, delta: number): void {
    if (this.running)
    {
      this.accumulator += Math.min(delta / 1000, 0.05);
      while (this.accumulator >= step && this.running)
      {
        this.simulate();
        this.accumulator -= step;
      }
    }
    this.draw();
    if (this.time.now > this.feedbackUntil)
    {
      message.textContent = '';
    }
  }

  private simulate(): void {
    this.x += this.speed * step;
    if (this.height > 0 || this.velocity > 0)
    {
      this.velocity -= balance.gravity * step;
      this.height += this.velocity * step;
      if (this.height <= 0)
      {
        this.height = 0;
        this.velocity = 0;
      }
    }
    for (const item of this.obstacles)
    {
      const distance = Math.abs(item.x - this.x);
      if (distance < (balance.playerSize + balance.obstacleWidth) / 2 && this.height < balance.obstacleHeight)
      {
        this.finish();
        return;
      }
      if (!item.checked && this.x - balance.playerSize / 2 > item.x + balance.obstacleWidth / 2)
      {
        item.checked = true;
        if (item.grade)
        {
          this.combo++;
          this.bestCombo = Math.max(this.bestCombo, this.combo);
          this.score += points(item.grade, this.combo);
          if (item.grade === 'PERFECT')
          {
            this.perfects++;
          }
          message.textContent = item.grade === 'PERFECT' ? '✦ PERFECT ✦' : item.grade;
          message.className = `message ${item.grade.toLowerCase()}`;
          this.feedbackUntil = this.time.now + 700;
        }
        else
        {
          this.combo = 0;
        }
        this.updateHud();
      }
    }
    if (this.height === 0 && this.velocity === 0)
    {
      this.applySpeed();
      if (this.held)
      {
        this.tryJump();
      }
    }
    this.obstacles = this.obstacles.filter(item => item.x > this.x - 100);
    const last = this.obstacles[this.obstacles.length - 1];
    if (last.x < this.x + W + balance.gapMax)
    {
      const gap = scaledGap(Phaser.Math.Between(balance.gapMin, balance.gapMax), this.speed);
      this.obstacles.push({ x: last.x + gap, grade: null, checked: false });
    }
  }

  private applySpeed(): void {
    if (this.speed === this.requestedSpeed)
    {
      // 같은 속도 요청은 장애물 배치를 바꾸지 않는다.
      return;
    }
    if (this.running || this.started)
    {
      const next = this.obstacles.find(item => !item.checked && item.x > this.x);
      const nextPosition = next && scaledPosition(next.x, this.x, this.speed, this.requestedSpeed);
      if (this.height > 0 || this.velocity > 0 || (nextPosition !== undefined && this.x > safeWindow(nextPosition, this.requestedSpeed).start))
      {
        // 진행 중인 점프나 가까운 장애물은 기존 속도로 통과한다.
        return;
      }
    }
    for (const item of this.obstacles)
    {
      if (!item.checked && item.x > this.x)
      {
        item.x = scaledPosition(item.x, this.x, this.speed, this.requestedSpeed);
        item.grade = null;
      }
    }
    this.speed = this.requestedSpeed;
    this.updateSpeedLabel();
  }

  private updateSpeedLabel(): void {
    const label = this.requestedSpeed < 220 ? '느림' : this.requestedSpeed < 310 ? '보통' : '빠름';
    const pending = this.speed !== this.requestedSpeed ? ' · 적용 대기' : '';
    speedValue.textContent = `${label} · ${(this.requestedSpeed / balance.speed).toFixed(2)}×${pending}`;
  }

  private updateHud(): void {
    scoreEl.textContent = String(this.score);
    comboEl.textContent = String(this.combo);
  }

  private finish(): void {
    this.running = false;
    this.held = false;
    let best = 0;
    try
    {
      best = Math.max(Number(localStorage.getItem('geometry-run-best') || 0), this.score);
      localStorage.setItem('geometry-run-best', String(best));
    }
    catch
    {
      // 저장할 수 없어도 이번 게임 결과는 보여준다.
      best = this.score;
    }
    overlay.innerHTML = `<div class="card"><div class="eyebrow">NICE RUN!</div><h1>다시 해볼까요?</h1><p>점수 <b>${this.score}</b> &nbsp; · &nbsp; 최고 점수 <b>${best}</b><br>최대 콤보 ${this.bestCombo} &nbsp; · &nbsp; PERFECT ${this.perfects}</p><button class="primary" id="retry">다시 달리기 <span>→</span></button></div>`;
    overlay.classList.remove('hidden');
    document.querySelector<HTMLButtonElement>('#retry')!.onclick = () => this.startRun();
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();
    g.fillStyle(0x152742).fillRect(0, 0, W, H);
    g.fillStyle(0x1b3652, 0.65);
    for (let i = 0; i < 9; i++)
    {
      const px = ((i * 180 - this.x * 0.15) % 1800 + 1800) % 1800 - 200;
      g.fillCircle(px, 170 + (i % 3) * 60, 65 + (i % 2) * 28);
    }
    g.fillStyle(0x213c52).fillRect(0, ground, W, H - ground);
    g.fillStyle(0x54d7c5).fillRect(0, ground, W, 4);
    g.lineStyle(1, 0x416374, 0.45);
    for (let i = -1; i < 20; i++)
    {
      const px = i * 80 - this.x % 80;
      g.lineBetween(px, ground + 35, px + 38, H);
    }
    for (const item of this.obstacles)
    {
      const px = item.x - this.x + playerScreenX;
      const window = safeWindow(item.x, this.speed);
      const start = window.start - this.x + playerScreenX;
      const end = window.end - this.x + playerScreenX;
      g.fillStyle(0x81e6d1, 0.24).fillRoundedRect(start, ground - 8, end - start, 7, 3);
      g.fillStyle(0xd8fff3, 0.8).fillCircle((start + end) / 2, ground - 5, 3);
      g.fillStyle(0xff8f81).fillRoundedRect(px - balance.obstacleWidth / 2, ground - balance.obstacleHeight, balance.obstacleWidth, balance.obstacleHeight, 6);
      g.fillStyle(0xffc0a9, 0.8).fillRoundedRect(px - 11, ground - balance.obstacleHeight + 7, 22, 5, 2);
    }
    const py = ground - this.height - balance.playerSize / 2;
    g.fillStyle(0x55d9c5, 0.15).fillEllipse(playerScreenX, ground + 10, 42 - Math.min(this.height / 10, 18), 8);
    g.fillStyle(0xffdb75).fillRoundedRect(playerScreenX - 18, py - 18, 36, 36, 8);
    g.fillStyle(0x233952).fillCircle(playerScreenX - 6, py - 2, 2.5).fillCircle(playerScreenX + 7, py - 2, 2.5);
    g.lineStyle(2, 0x233952).lineBetween(playerScreenX - 3, py + 7, playerScreenX + 4, py + 7);
    if (!this.started)
    {
      g.fillStyle(0xff8f81).fillRoundedRect(640, ground - 38, 34, 38, 6);
    }
  }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'canvas', width: W, height: H, backgroundColor: '#152742', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: RunScene });
