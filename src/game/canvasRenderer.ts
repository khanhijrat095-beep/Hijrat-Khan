import {
  GameStateSnapshot,
  PlayerState,
  VisualImpactEvent,
  PowerupType,
} from '../types/game';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  life: number;
  type?: 'spark' | 'smoke' | 'debris' | 'flash';
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface TreadMark {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private treadMarks: TreadMark[] = [];
  private cameraX = 1200;
  private cameraY = 1200;
  private shakeTime = 0;
  private shakeIntensity = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  public resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  public addScreenShake(intensity = 8, duration = 0.25) {
    this.shakeIntensity = intensity;
    this.shakeTime = duration;
  }

  public addVisualEvent(event: VisualImpactEvent) {
    if (event.type === 'explosion') {
      const count = event.radius && event.radius > 60 ? 45 : 25;
      const color = event.color || '#f97316';
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 8;
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3 + Math.random() * 5,
          color,
          alpha: 1,
          decay: 0.02 + Math.random() * 0.03,
          life: 1,
          type: 'spark',
        });
      }
      // Add smoke
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 3;
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 8 + Math.random() * 12,
          color: '#334155',
          alpha: 0.7,
          decay: 0.015,
          life: 1,
          type: 'smoke',
        });
      }
      this.addScreenShake(event.radius && event.radius > 60 ? 14 : 7, 0.3);
    } else if (event.type === 'hit') {
      const color = event.color || '#f59e0b';
      for (let i = 0; i < 8; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4;
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 2 + Math.random() * 3,
          color,
          alpha: 1,
          decay: 0.06,
          life: 1,
          type: 'spark',
        });
      }
      if (event.damage) {
        this.floatingTexts.push({
          id: `ft-${Date.now()}-${Math.random()}`,
          x: event.x + (Math.random() - 0.5) * 20,
          y: event.y - 20,
          text: `-${Math.round(event.damage)}`,
          color: '#ef4444',
          alpha: 1,
          vy: -1.4,
        });
      }
    } else if (event.type === 'bounce') {
      for (let i = 0; i < 5; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 3;
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 2,
          color: event.color || '#38bdf8',
          alpha: 1,
          decay: 0.08,
          life: 1,
          type: 'spark',
        });
      }
    } else if (event.type === 'pickup') {
      if (event.text) {
        this.floatingTexts.push({
          id: `ft-p-${Date.now()}`,
          x: event.x,
          y: event.y - 30,
          text: `+ ${event.text}`,
          color: '#10b981',
          alpha: 1,
          vy: -1.6,
        });
      }
      // Green pickup shimmer particles
      for (let i = 0; i < 15; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 4;
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3,
          color: '#10b981',
          alpha: 1,
          decay: 0.04,
          life: 1,
          type: 'spark',
        });
      }
    } else if (event.type === 'ability') {
      const radius = event.radius || 120;
      const count = 30;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const spd = (radius / 15) * (0.8 + Math.random() * 0.4);
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 4,
          color: event.color || '#06b6d4',
          alpha: 1,
          decay: 0.04,
          life: 1,
          type: 'spark',
        });
      }
    }
  }

  public render(
    state: GameStateSnapshot,
    myPlayerId: string | null,
    viewW: number,
    viewH: number,
    mouseWorldX: number,
    mouseWorldY: number,
    reloadProgress: number
  ) {
    const ctx = this.ctx;
    const now = Date.now();

    // 1. Camera Centering
    const myPlayer = myPlayerId ? state.players[myPlayerId] : null;
    if (myPlayer && myPlayer.isAlive) {
      // Smooth lerp
      this.cameraX += (myPlayer.x - this.cameraX) * 0.12;
      this.cameraY += (myPlayer.y - this.cameraY) * 0.12;
    }

    // Screen Shake Offset
    let offsetX = 0;
    let offsetY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= 0.016;
      offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      offsetY = (Math.random() - 0.5) * this.shakeIntensity;
    }

    const halfW = viewW / 2;
    const halfH = viewH / 2;
    const originX = halfW - this.cameraX + offsetX;
    const originY = halfH - this.cameraY + offsetY;

    // Clear background
    ctx.fillStyle = '#070b13';
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(originX, originY);

    // 2. Arena Floor & Neon Grid
    this.drawFloor(state.arenaWidth, state.arenaHeight);

    // 3. Tread Marks
    this.drawTreadMarks();

    // 4. Speed Pads
    this.drawSpeedPads(state.speedPads, now);

    // 5. Obstacles & Crates
    this.drawObstacles(state.obstacles);

    // 6. Powerups
    this.drawPowerups(state.powerups, now);

    // 7. Bullets
    this.drawBullets(state.bullets);

    // 8. Tanks
    this.drawTanks(state.players, myPlayerId, now);

    // 9. Particles
    this.updateAndDrawParticles();

    // 10. Floating Combat Text
    this.drawFloatingTexts();

    ctx.restore();

    // 11. Tactical Reticle / Crosshair (Screen Space)
    if (myPlayer && myPlayer.isAlive) {
      const mouseScreenX = mouseWorldX - this.cameraX + halfW;
      const mouseScreenY = mouseWorldY - this.cameraY + halfH;
      this.drawCrosshair(mouseScreenX, mouseScreenY, reloadProgress);
    }

    // 12. Minimap (Screen Space bottom right or top right)
    this.drawMinimap(state, myPlayerId, viewW, viewH);
  }

  private drawFloor(width: number, height: number) {
    const ctx = this.ctx;

    // Arena boundary backplate
    ctx.fillStyle = '#0b1324';
    ctx.fillRect(0, 0, width, height);

    // Tech Grid
    const gridSize = 100;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Center arena emblem / ring
    const cx = width / 2;
    const cy = height / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 220, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, 400, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawTreadMarks() {
    const ctx = this.ctx;
    ctx.save();
    for (let i = this.treadMarks.length - 1; i >= 0; i--) {
      const t = this.treadMarks[i];
      t.alpha -= 0.003;
      if (t.alpha <= 0) {
        this.treadMarks.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = `rgba(15, 23, 42, ${t.alpha * 0.4})`;
      ctx.fillRect(-12, -18, 6, 36);
      ctx.fillRect(6, -18, 6, 36);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawSpeedPads(pads: GameStateSnapshot['speedPads'], now: number) {
    const ctx = this.ctx;
    for (const pad of pads) {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 2;
      ctx.fillRect(pad.x, pad.y, pad.width, pad.height);
      ctx.strokeRect(pad.x, pad.y, pad.width, pad.height);

      // Moving animated arrows inside pad
      const pulse = (now * 0.004) % 1;
      const arrowCx = pad.x + pad.width / 2;
      const arrowCy = pad.y + pad.height / 2;
      ctx.translate(arrowCx, arrowCy);
      const angle = Math.atan2(pad.dirY, pad.dirX);
      ctx.rotate(angle);

      ctx.fillStyle = `rgba(16, 185, 129, ${0.4 + Math.sin(pulse * Math.PI) * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(-16, -14);
      ctx.lineTo(12, 0);
      ctx.lineTo(-16, 14);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private drawObstacles(obstacles: GameStateSnapshot['obstacles']) {
    const ctx = this.ctx;
    for (const obs of obstacles) {
      if (obs.isDestructible && obs.health <= 0) continue;

      ctx.save();
      if (obs.isDestructible) {
        // Crate
        const healthPct = Math.max(0, obs.health / obs.maxHealth);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Cross straps
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.moveTo(obs.x + obs.width, obs.y);
        ctx.lineTo(obs.x, obs.y + obs.height);
        ctx.stroke();

        // Mini health bar on crate if damaged
        if (healthPct < 1.0) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(obs.x, obs.y - 8, obs.width, 5);
          ctx.fillStyle = healthPct > 0.4 ? '#10b981' : '#ef4444';
          ctx.fillRect(obs.x, obs.y - 8, obs.width * healthPct, 5);
        }
      } else {
        // Blast Wall / Fortress Pillar
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Tech bevel inner line
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.strokeRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);
      }
      ctx.restore();
    }
  }

  private drawPowerups(powerups: GameStateSnapshot['powerups'], now: number) {
    const ctx = this.ctx;
    for (const p of powerups) {
      const bob = Math.sin(now * 0.005 + p.x) * 4;
      const cy = p.y + bob;

      ctx.save();
      ctx.translate(p.x, cy);

      // Glowing aura
      const auraGradient = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
      let pColor = '#38bdf8';
      let icon = '⚡';

      if (p.type === 'TRIPLE_SHOT') {
        pColor = '#f59e0b';
        icon = '💥';
      } else if (p.type === 'PLASMA_CANNON') {
        pColor = '#06b6d4';
        icon = '🔬';
      } else if (p.type === 'SHIELD_REPAIR') {
        pColor = '#3b82f6';
        icon = '🛡️';
      } else if (p.type === 'HEALTH_PACK') {
        pColor = '#10b981';
        icon = '➕';
      } else if (p.type === 'BOUNCE_OVERCHARGE') {
        pColor = '#a855f7';
        icon = '💫';
      }

      auraGradient.addColorStop(0, `${pColor}88`);
      auraGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();

      // Core Diamond / Hexagon
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const s = 18;
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Icon text
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, 0);

      ctx.restore();
    }
  }

  private drawBullets(bullets: GameStateSnapshot['bullets']) {
    const ctx = this.ctx;
    for (const b of bullets) {
      ctx.save();

      // Trail
      const trailLen = 14;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > 0) {
        const nx = b.vx / speed;
        const ny = b.vy / speed;
        const grad = ctx.createLinearGradient(b.x - nx * trailLen, b.y - ny * trailLen, b.x, b.y);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, b.color);
        ctx.strokeStyle = grad;
        ctx.lineWidth = b.radius * 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x - nx * trailLen, b.y - ny * trailLen);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Bullet Core
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // White hot center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawTanks(
    players: Record<string, PlayerState>,
    myPlayerId: string | null,
    now: number
  ) {
    const ctx = this.ctx;

    for (const player of Object.values(players)) {
      if (!player.isAlive) continue;

      ctx.save();
      ctx.translate(player.x, player.y);

      // Record tread mark if moving
      const isMoving = Math.abs(player.vx) > 0.3 || Math.abs(player.vy) > 0.3;
      if (isMoving && Math.random() < 0.25) {
        this.treadMarks.push({
          x: player.x,
          y: player.y,
          angle: player.bodyAngle,
          alpha: 0.6,
        });
        if (this.treadMarks.length > 300) {
          this.treadMarks.shift();
        }
      }

      // --- Invulnerability Aura Bubble ---
      if (player.invulnerableTimer > 0) {
        ctx.save();
        const pulse = 0.6 + Math.sin(now * 0.01) * 0.3;
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // --- Active Aegis Shield Dome ---
      if (player.shield > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // --- Tank Chassis (Rotates with bodyAngle) ---
      ctx.save();
      ctx.rotate(player.bodyAngle);

      // Treads (Left & Right)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-22, -26, 44, 10);
      ctx.fillRect(-22, 16, 44, 10);

      // Tread Grooves
      ctx.fillStyle = '#334155';
      for (let tx = -18; tx <= 16; tx += 7) {
        ctx.fillRect(tx, -26, 3, 10);
        ctx.fillRect(tx, 16, 3, 10);
      }

      // Tank Hull Body
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-18, -17, 36, 34);

      // Armor plating highlight
      ctx.fillStyle = player.color;
      ctx.fillRect(-14, -14, 28, 28);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -14, 28, 28);

      ctx.restore(); // End body rotation

      // --- Tank Cannon Turret (Rotates with cannonAngle) ---
      ctx.save();
      ctx.rotate(player.cannonAngle);

      // Barrel length & styling depends on class
      let barrelLen = 30;
      let barrelW = 8;
      if (player.tankClass === 'sniper') {
        barrelLen = 42;
        barrelW = 6;
      } else if (player.tankClass === 'titan') {
        barrelLen = 28;
        barrelW = 12;
      } else if (player.tankClass === 'scout') {
        barrelLen = 24;
        barrelW = 7;
      }

      // Barrel shadow & stroke
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, -barrelW / 2, barrelLen, barrelW);
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, -barrelW / 2 + 1, barrelLen, barrelW - 2);

      // Muzzle brake
      ctx.fillStyle = player.color;
      ctx.fillRect(barrelLen - 5, -barrelW / 2 - 1, 5, barrelW + 2);

      // Turret Dome
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // Turret hatch ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore(); // End turret rotation

      // --- Health & Info Overhead HUD ---
      const isMe = player.id === myPlayerId;
      ctx.save();

      // Floating Emote
      if (player.recentEmote && now - player.recentEmote.timestamp < 3500) {
        const emoteAge = (now - player.recentEmote.timestamp) / 3500;
        const emoteY = -52 - emoteAge * 20;
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(player.recentEmote.emoji, 0, emoteY);
      }

      // Callsign Name
      ctx.font = isMe ? 'bold 13px Orbitron, sans-serif' : '12px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isMe ? '#38bdf8' : '#e2e8f0';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      const streakSuffix = player.streak >= 2 ? ` 🔥${player.streak}` : '';
      ctx.fillText(`${player.name}${streakSuffix}`, 0, -36);
      ctx.shadowBlur = 0;

      // Health Bar
      const barW = 44;
      const barH = 5;
      const barX = -barW / 2;
      const barY = -30;
      const hpPct = Math.max(0, Math.min(1, player.health / player.maxHealth));

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      ctx.fillStyle = hpPct > 0.5 ? '#10b981' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpPct, barH);

      // Shield Bar (if any)
      if (player.shield > 0) {
        const shieldPct = Math.min(1, player.shield / 100);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(barX, barY - 4, barW * shieldPct, 3);
      }

      ctx.restore();

      ctx.restore();
    }
  }

  private updateAndDrawParticles() {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      if (p.type === 'smoke') {
        p.size += 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawFloatingTexts() {
    const ctx = this.ctx;
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.02;

      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = 'bold 15px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private drawCrosshair(x: number, y: number, reloadProgress: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Crosshair Lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // Top
    ctx.moveTo(0, -7);
    ctx.lineTo(0, -18);
    // Bottom
    ctx.moveTo(0, 7);
    ctx.lineTo(0, 18);
    // Left
    ctx.moveTo(-7, 0);
    ctx.lineTo(-18, 0);
    // Right
    ctx.moveTo(7, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Reload circle gauge
    if (reloadProgress < 1.0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + reloadProgress * Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawMinimap(
    state: GameStateSnapshot,
    myPlayerId: string | null,
    viewW: number,
    viewH: number
  ) {
    const ctx = this.ctx;
    const mapSize = 140;
    const margin = 18;
    const mapX = viewW - mapSize - margin;
    const mapY = viewH - mapSize - margin;

    ctx.save();
    // Radar background
    ctx.fillStyle = 'rgba(11, 19, 36, 0.85)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    const scale = mapSize / state.arenaWidth;

    // Obstacles
    ctx.fillStyle = 'rgba(71, 85, 105, 0.6)';
    for (const obs of state.obstacles) {
      if (obs.isDestructible && obs.health <= 0) continue;
      ctx.fillRect(mapX + obs.x * scale, mapY + obs.y * scale, Math.max(1, obs.width * scale), Math.max(1, obs.height * scale));
    }

    // Powerups
    ctx.fillStyle = '#f59e0b';
    for (const p of state.powerups) {
      ctx.fillRect(mapX + p.x * scale - 1, mapY + p.y * scale - 1, 2, 2);
    }

    // Tanks
    for (const p of Object.values(state.players)) {
      if (!p.isAlive) continue;
      const isMe = p.id === myPlayerId;
      ctx.fillStyle = isMe ? '#38bdf8' : p.color;
      const dotSize = isMe ? 4 : 3;
      ctx.beginPath();
      ctx.arc(mapX + p.x * scale, mapY + p.y * scale, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Radar scan line
    const scanAngle = (Date.now() * 0.002) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    ctx.moveTo(mapX + mapSize / 2, mapY + mapSize / 2);
    ctx.lineTo(
      mapX + mapSize / 2 + Math.cos(scanAngle) * (mapSize / 2),
      mapY + mapSize / 2 + Math.sin(scanAngle) * (mapSize / 2)
    );
    ctx.stroke();

    ctx.restore();
  }
}
