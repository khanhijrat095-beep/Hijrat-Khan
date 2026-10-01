import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TANK_CLASSES,
  TankClassId,
  PlayerState,
  BulletState,
  PowerupItem,
  Obstacle,
  SpeedPad,
  KillFeedItem,
  ChatMessage,
  VisualImpactEvent,
  GameStateSnapshot,
  ClientMessage,
  ServerMessage,
  GameRoomSummary,
} from './src/types/game';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  TANK_RADIUS,
  generateDefaultArena,
  checkCircleRectCollision,
  resolveTankObstacleCollisions,
  getRandomPowerupType,
} from './src/game/physics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// --- Room & Player Data Structures ---
interface ConnectedClient {
  ws: WebSocket;
  id: string;
  roomId: string;
  name: string;
  color: string;
  tankClass: TankClassId;
  team: 'none' | 'blue' | 'red';
  lastPing: number;
}

interface Room {
  id: string;
  name: string;
  gameMode: 'deathmatch' | 'team';
  obstacles: Obstacle[];
  speedPads: SpeedPad[];
  players: Record<string, PlayerState>;
  bullets: BulletState[];
  powerups: PowerupItem[];
  clients: Map<string, ConnectedClient>;
  tickCount: number;
  lastShootTime: Record<string, number>;
  lastBulletId: number;
  teamScores: { blue: number; red: number };
  botCounter: number;
}

const rooms = new Map<string, Room>();

function createRoom(id: string, name: string, gameMode: 'deathmatch' | 'team' = 'deathmatch'): Room {
  const { obstacles, speedPads } = generateDefaultArena();
  const room: Room = {
    id,
    name,
    gameMode,
    obstacles,
    speedPads,
    players: {},
    bullets: [],
    powerups: [],
    clients: new Map(),
    tickCount: 0,
    lastShootTime: {},
    lastBulletId: 0,
    teamScores: { blue: 0, red: 0 },
    botCounter: 0,
  };
  rooms.set(id, room);
  return room;
}

// Pre-create initial lobbies
createRoom('arena-alpha', 'Neo Neo-Tokyo (Free For All)', 'deathmatch');
createRoom('arena-beta', 'Red vs Blue (Team Clash)', 'team');

function getSafeSpawnPosition(room: Room): { x: number; y: number } {
  const safePad = 140;
  for (let attempt = 0; attempt < 30; attempt++) {
    const rx = safePad + Math.random() * (ARENA_WIDTH - safePad * 2);
    const ry = safePad + Math.random() * (ARENA_HEIGHT - safePad * 2);

    // Check collision with obstacles
    let hitObstacle = false;
    for (const obs of room.obstacles) {
      if (checkCircleRectCollision(rx, ry, TANK_RADIUS + 20, obs.x, obs.y, obs.width, obs.height).collides) {
        hitObstacle = true;
        break;
      }
    }
    if (!hitObstacle) {
      return { x: rx, y: ry };
    }
  }
  return { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
}

function broadcastToRoom(room: Room, message: ServerMessage, excludeId?: string) {
  const data = JSON.stringify(message);
  for (const [clientId, client] of room.clients.entries()) {
    if (clientId === excludeId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function getRoomSummaries(): GameRoomSummary[] {
  const list: GameRoomSummary[] = [];
  for (const [id, r] of rooms.entries()) {
    list.push({
      id,
      name: r.name,
      playerCount: Object.keys(r.players).length,
      maxPlayers: 16,
      gameMode: r.gameMode,
    });
  }
  return list;
}

function spawnBot(room: Room, classId: TankClassId = 'assault'): string {
  room.botCounter++;
  const botId = `bot-${Date.now()}-${room.botCounter}`;
  const botNames = ['TitanBot', 'GhostRecon', 'CyberViper', 'IronClad', 'BlitzWolf', 'ShadowUnit', 'ApexDrone'];
  const botName = botNames[room.botCounter % botNames.length] + ' [AI]';
  const colors = ['#f43f5e', '#a855f7', '#eab308', '#06b6d4', '#10b981', '#f97316'];
  const color = colors[room.botCounter % colors.length];

  const spawnPos = getSafeSpawnPosition(room);
  const classStats = TANK_CLASSES[classId] || TANK_CLASSES.assault;

  let team: 'none' | 'blue' | 'red' = 'none';
  if (room.gameMode === 'team') {
    let blueCount = 0;
    let redCount = 0;
    Object.values(room.players).forEach((p) => {
      if (p.team === 'blue') blueCount++;
      if (p.team === 'red') redCount++;
    });
    team = blueCount <= redCount ? 'blue' : 'red';
  }

  const botPlayer: PlayerState = {
    id: botId,
    name: botName,
    color,
    tankClass: classId,
    team,
    x: spawnPos.x,
    y: spawnPos.y,
    vx: 0,
    vy: 0,
    bodyAngle: Math.random() * Math.PI * 2,
    cannonAngle: Math.random() * Math.PI * 2,
    health: classStats.maxHealth,
    maxHealth: classStats.maxHealth,
    shield: 0,
    isAlive: true,
    respawnTimer: 0,
    invulnerableTimer: 2.0,
    score: 0,
    kills: 0,
    deaths: 0,
    streak: 0,
    activePowerup: null,
    powerupTimeRemaining: 0,
    abilityCooldownRemaining: 0,
    isBot: true,
    recentEmote: null,
  };

  room.players[botId] = botPlayer;
  room.lastShootTime[botId] = 0;

  broadcastToRoom(room, {
    type: 'chat',
    message: {
      id: `sys-${Date.now()}`,
      senderId: 'system',
      senderName: 'HQ Combat Dispatch',
      senderColor: '#94a3b8',
      text: `${botName} deployed into arena.`,
      timestamp: Date.now(),
      isSystem: true,
    },
  });

  return botId;
}

// --- WebSocket Connection Management ---
wss.on('connection', (ws) => {
  let currentClient: ConnectedClient | null = null;

  ws.on('message', (rawData) => {
    try {
      const msg: ClientMessage = JSON.parse(rawData.toString());

      if (msg.type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
        }
        return;
      }

      if (msg.type === 'join') {
        const roomId = msg.roomId || 'arena-alpha';
        let room = rooms.get(roomId);
        if (!room) {
          room = createRoom(roomId, `Room ${roomId.toUpperCase()}`, msg.mode || 'deathmatch');
        }

        const clientId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const spawnPos = getSafeSpawnPosition(room);
        const classStats = TANK_CLASSES[msg.tankClass] || TANK_CLASSES.assault;

        let team = msg.team || 'none';
        if (room.gameMode === 'team' && team === 'none') {
          let blueCount = 0;
          let redCount = 0;
          Object.values(room.players).forEach((p) => {
            if (p.team === 'blue') blueCount++;
            if (p.team === 'red') redCount++;
          });
          team = blueCount <= redCount ? 'blue' : 'red';
        }

        const newPlayer: PlayerState = {
          id: clientId,
          name: (msg.name || 'Commander').trim().slice(0, 16),
          color: msg.color || '#38bdf8',
          tankClass: msg.tankClass || 'assault',
          team,
          x: spawnPos.x,
          y: spawnPos.y,
          vx: 0,
          vy: 0,
          bodyAngle: 0,
          cannonAngle: 0,
          health: classStats.maxHealth,
          maxHealth: classStats.maxHealth,
          shield: 0,
          isAlive: true,
          respawnTimer: 0,
          invulnerableTimer: 3.5,
          score: 0,
          kills: 0,
          deaths: 0,
          streak: 0,
          activePowerup: null,
          powerupTimeRemaining: 0,
          abilityCooldownRemaining: 0,
          isBot: false,
          recentEmote: null,
        };

        room.players[clientId] = newPlayer;
        room.lastShootTime[clientId] = 0;

        currentClient = {
          ws,
          id: clientId,
          roomId: room.id,
          name: newPlayer.name,
          color: newPlayer.color,
          tankClass: newPlayer.tankClass,
          team: newPlayer.team,
          lastPing: Date.now(),
        };
        room.clients.set(clientId, currentClient);

        // Send welcome
        ws.send(
          JSON.stringify({
            type: 'welcome',
            playerId: clientId,
            arenaWidth: ARENA_WIDTH,
            arenaHeight: ARENA_HEIGHT,
            roomId: room.id,
            roomList: getRoomSummaries(),
          })
        );

        // System notification
        broadcastToRoom(room, {
          type: 'chat',
          message: {
            id: `sys-${Date.now()}`,
            senderId: 'system',
            senderName: 'HQ Arena',
            senderColor: '#38bdf8',
            text: `${newPlayer.name} has joined the battlefield!`,
            timestamp: Date.now(),
            isSystem: true,
          },
        });

        // If player is alone in a room, spawn 2 practice bots so they have immediate targets to fight!
        const humanCount = Array.from(room.clients.values()).filter((c) => !room?.players[c.id]?.isBot).length;
        const totalPlayers = Object.keys(room.players).length;
        if (humanCount === 1 && totalPlayers === 1) {
          spawnBot(room, 'assault');
          spawnBot(room, 'scout');
        }

        return;
      }

      if (!currentClient) return;
      const room = rooms.get(currentClient.roomId);
      if (!room) return;
      const player = room.players[currentClient.id];
      if (!player) return;

      if (msg.type === 'input') {
        if (!player.isAlive) return;
        const { moveX, moveY, cannonAngle, isShooting, triggerAbility } = msg.input;

        // Normalize movement vector
        let length = Math.sqrt(moveX * moveX + moveY * moveY);
        let normX = 0;
        let normY = 0;
        if (length > 0) {
          normX = moveX / length;
          normY = moveY / length;
        }

        const classStats = TANK_CLASSES[player.tankClass] || TANK_CLASSES.assault;
        let currentSpeed = classStats.speed;

        // Apply Speed boost powerup or class ability
        if (player.activePowerup === 'SPEED_BOOST') {
          currentSpeed *= 1.45;
        }
        if (player.tankClass === 'scout' && player.powerupTimeRemaining > 0 && player.activePowerup === null) {
          currentSpeed *= 1.45;
        }

        player.vx = normX * currentSpeed;
        player.vy = normY * currentSpeed;

        if (length > 0.1) {
          player.bodyAngle = Math.atan2(normY, normX);
        }
        player.cannonAngle = cannonAngle;

        // Trigger class ability
        if (triggerAbility && player.abilityCooldownRemaining <= 0) {
          player.abilityCooldownRemaining = classStats.abilityCooldown / 1000;

          if (player.tankClass === 'assault') {
            // Hyper Dash
            const dashSpeed = 16;
            player.vx = Math.cos(player.cannonAngle) * dashSpeed;
            player.vy = Math.sin(player.cannonAngle) * dashSpeed;
            player.invulnerableTimer = Math.max(player.invulnerableTimer, 0.4);
            broadcastToRoom(room, {
              type: 'visualEvent',
              event: { id: `dash-${Date.now()}`, type: 'ability', x: player.x, y: player.y, color: '#38bdf8' },
            });
          } else if (player.tankClass === 'scout') {
            // Overdrive
            player.powerupTimeRemaining = 4.0;
            broadcastToRoom(room, {
              type: 'visualEvent',
              event: { id: `turbo-${Date.now()}`, type: 'ability', x: player.x, y: player.y, color: '#a855f7' },
            });
          } else if (player.tankClass === 'titan') {
            // Aegis Barrier
            player.shield = Math.min(player.shield + 80, 140);
            broadcastToRoom(room, {
              type: 'visualEvent',
              event: { id: `shield-${Date.now()}`, type: 'ability', x: player.x, y: player.y, color: '#f59e0b' },
            });
          } else if (player.tankClass === 'sniper') {
            // EMP Shockwave
            broadcastToRoom(room, {
              type: 'visualEvent',
              event: { id: `emp-${Date.now()}`, type: 'ability', x: player.x, y: player.y, radius: 260, color: '#06b6d4' },
            });
            // Push away nearby enemy tanks and deal shock damage
            for (const other of Object.values(room.players)) {
              if (other.id === player.id || !other.isAlive) continue;
              if (room.gameMode === 'team' && other.team === player.team) continue;
              const dx = other.x - player.x;
              const dy = other.y - player.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 260 && dist > 1) {
                const pushStrength = (260 - dist) / 12;
                other.vx += (dx / dist) * pushStrength;
                other.vy += (dy / dist) * pushStrength;
                other.health = Math.max(1, other.health - 25);
              }
            }
          }
        }

        // Shooting check
        if (isShooting) {
          const now = Date.now();
          const lastShot = room.lastShootTime[player.id] || 0;
          let reloadTime = classStats.reloadTime;

          if (player.tankClass === 'scout' && player.powerupTimeRemaining > 0) {
            reloadTime *= 0.7;
          }

          if (now - lastShot >= reloadTime) {
            room.lastShootTime[player.id] = now;
            fireBullet(room, player);
          }
        }
        return;
      }

      if (msg.type === 'emote') {
        player.recentEmote = { emoji: msg.emoji, timestamp: Date.now() };
        return;
      }

      if (msg.type === 'chat') {
        const text = (msg.text || '').trim().slice(0, 100);
        if (text) {
          broadcastToRoom(room, {
            type: 'chat',
            message: {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              senderId: player.id,
              senderName: player.name,
              senderColor: player.color,
              text,
              timestamp: Date.now(),
            },
          });
        }
        return;
      }

      if (msg.type === 'addBot') {
        spawnBot(room, msg.classId || 'assault');
        return;
      }

      if (msg.type === 'removeBots') {
        for (const [id, p] of Object.entries(room.players)) {
          if (p.isBot) {
            delete room.players[id];
          }
        }
        return;
      }

      if (msg.type === 'respawn') {
        if (!player.isAlive && player.respawnTimer <= 0) {
          const spawn = getSafeSpawnPosition(room);
          const stats = TANK_CLASSES[player.tankClass] || TANK_CLASSES.assault;
          player.x = spawn.x;
          player.y = spawn.y;
          player.vx = 0;
          player.vy = 0;
          player.health = stats.maxHealth;
          player.shield = 0;
          player.isAlive = true;
          player.invulnerableTimer = 3.5;
          player.activePowerup = null;
        }
        return;
      }
    } catch {
      // Ignore invalid JSON
    }
  });

  ws.on('close', () => {
    if (currentClient) {
      const room = rooms.get(currentClient.roomId);
      if (room) {
        room.clients.delete(currentClient.id);
        const player = room.players[currentClient.id];
        if (player) {
          broadcastToRoom(room, {
            type: 'chat',
            message: {
              id: `sys-${Date.now()}`,
              senderId: 'system',
              senderName: 'HQ Arena',
              senderColor: '#64748b',
              text: `${player.name} left the arena.`,
              timestamp: Date.now(),
              isSystem: true,
            },
          });
          delete room.players[currentClient.id];
        }
      }
    }
  });
});

function fireBullet(room: Room, player: PlayerState) {
  const classStats = TANK_CLASSES[player.tankClass] || TANK_CLASSES.assault;
  const barrelLength = 34;
  const startX = player.x + Math.cos(player.cannonAngle) * barrelLength;
  const startY = player.y + Math.sin(player.cannonAngle) * barrelLength;

  const hasTriple = player.activePowerup === 'TRIPLE_SHOT';
  const hasPlasma = player.activePowerup === 'PLASMA_CANNON';
  const hasBounce = player.activePowerup === 'BOUNCE_OVERCHARGE';

  const angles = hasTriple
    ? [player.cannonAngle - 0.22, player.cannonAngle, player.cannonAngle + 0.22]
    : [player.cannonAngle];

  for (const ang of angles) {
    room.lastBulletId++;
    const bulletId = `b-${room.lastBulletId}-${Date.now()}`;
    const speed = hasPlasma ? 20 : classStats.bulletSpeed;
    const damage = hasPlasma ? 48 : classStats.damage;
    const bounces = hasBounce ? classStats.bulletBounces + 3 : classStats.bulletBounces;

    const bullet: BulletState = {
      id: bulletId,
      ownerId: player.id,
      ownerName: player.name,
      x: startX,
      y: startY,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      damage,
      radius: hasPlasma ? 9 : classStats.bulletRadius,
      color: hasPlasma ? '#06b6d4' : player.color,
      bouncesLeft: bounces,
      isPiercing: hasPlasma,
      type: hasPlasma ? 'plasma' : player.tankClass === 'sniper' ? 'sniper' : 'standard',
      lifeTime: 0,
    };

    room.bullets.push(bullet);
  }
}

// --- Server-Authoritative Simulation Loop (30 Ticks / sec) ---
const TICK_INTERVAL = 33.3; // ~30 FPS
const DT = 0.0333; // seconds

setInterval(() => {
  for (const room of rooms.values()) {
    room.tickCount++;

    // 1. Update Bots AI
    updateBots(room);

    // 2. Update Players Position & Collisions
    for (const player of Object.values(room.players)) {
      if (!player.isAlive) {
        if (player.respawnTimer > 0) {
          player.respawnTimer -= DT;
          if (player.respawnTimer <= 0 && player.isBot) {
            // Bots auto-respawn
            const spawn = getSafeSpawnPosition(room);
            const stats = TANK_CLASSES[player.tankClass] || TANK_CLASSES.assault;
            player.x = spawn.x;
            player.y = spawn.y;
            player.health = stats.maxHealth;
            player.shield = 0;
            player.isAlive = true;
            player.invulnerableTimer = 3.0;
          }
        }
        continue;
      }

      // Decrement timers
      if (player.invulnerableTimer > 0) player.invulnerableTimer -= DT;
      if (player.abilityCooldownRemaining > 0) player.abilityCooldownRemaining -= DT;
      if (player.powerupTimeRemaining > 0) {
        player.powerupTimeRemaining -= DT;
        if (player.powerupTimeRemaining <= 0) {
          player.activePowerup = null;
        }
      }

      // Check Speed Pads
      for (const pad of room.speedPads) {
        if (
          player.x >= pad.x &&
          player.x <= pad.x + pad.width &&
          player.y >= pad.y &&
          player.y <= pad.y + pad.height
        ) {
          player.vx += pad.dirX * 3.5;
          player.vy += pad.dirY * 3.5;
        }
      }

      // Integrate velocity
      player.x += player.vx;
      player.y += player.vy;

      // Friction / decay
      player.vx *= 0.88;
      player.vy *= 0.88;

      // Obstacle & boundary collisions
      resolveTankObstacleCollisions(player, room.obstacles, TANK_RADIUS);
    }

    // 3. Tank-to-Tank Collisions (soft push)
    const playerList = Object.values(room.players).filter((p) => p.isAlive);
    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        const p1 = playerList[i];
        const p2 = playerList[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = TANK_RADIUS * 2;
        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;
        }
      }
    }

    // 4. Update Bullets
    const remainingBullets: BulletState[] = [];
    for (const b of room.bullets) {
      b.lifeTime += DT;
      if (b.lifeTime > 5.0) continue; // Expiration

      let shouldKeep = true;

      // Sub-step movement to prevent tunnelling through walls
      const subSteps = 2;
      const stepVx = b.vx / subSteps;
      const stepVy = b.vy / subSteps;

      for (let s = 0; s < subSteps; s++) {
        b.x += stepVx;
        b.y += stepVy;

        // Check Obstacles
        for (const obs of room.obstacles) {
          if (obs.isDestructible && obs.health <= 0) continue;

          const col = checkCircleRectCollision(b.x, b.y, b.radius, obs.x, obs.y, obs.width, obs.height);
          if (col.collides) {
            if (obs.isDestructible) {
              obs.health -= b.damage;
              broadcastToRoom(room, {
                type: 'visualEvent',
                event: { id: `hit-crate-${Date.now()}`, type: 'hit', x: b.x, y: b.y, damage: b.damage },
              });

              if (obs.health <= 0) {
                // Crate destroyed: spawn powerup!
                const pType = getRandomPowerupType();
                room.powerups.push({
                  id: `pow-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  type: pType,
                  x: obs.x + obs.width / 2,
                  y: obs.y + obs.height / 2,
                  radius: 18,
                  spawnTime: Date.now(),
                  durationRemaining: 30,
                });
                broadcastToRoom(room, {
                  type: 'visualEvent',
                  event: { id: `exp-crate-${Date.now()}`, type: 'explosion', x: obs.x + obs.width / 2, y: obs.y + obs.height / 2, radius: 45, color: '#f59e0b' },
                });
              }
              shouldKeep = false;
              break;
            } else {
              // Wall bounce
              if (b.bouncesLeft > 0) {
                b.bouncesLeft--;
                // Reflect velocity
                const dot = b.vx * col.normalX + b.vy * col.normalY;
                b.vx -= 2 * dot * col.normalX;
                b.vy -= 2 * dot * col.normalY;
                b.x += col.normalX * (col.penetration + 2);
                b.y += col.normalY * (col.penetration + 2);
                broadcastToRoom(room, {
                  type: 'visualEvent',
                  event: { id: `bounce-${Date.now()}`, type: 'bounce', x: b.x, y: b.y, color: b.color },
                });
                break;
              } else {
                broadcastToRoom(room, {
                  type: 'visualEvent',
                  event: { id: `hit-wall-${Date.now()}`, type: 'hit', x: b.x, y: b.y },
                });
                shouldKeep = false;
                break;
              }
            }
          }
        }

        if (!shouldKeep) break;

        // Check Tank Hits
        for (const target of Object.values(room.players)) {
          if (!target.isAlive || target.id === b.ownerId || target.invulnerableTimer > 0) continue;
          if (room.gameMode === 'team') {
            const shooter = room.players[b.ownerId];
            if (shooter && shooter.team === target.team) continue;
          }

          const dx = target.x - b.x;
          const dy = target.y - b.y;
          const distSq = dx * dx + dy * dy;
          const hitRadius = TANK_RADIUS + b.radius;

          if (distSq <= hitRadius * hitRadius) {
            // Hit tank!
            let dealt = b.damage;
            if (target.shield > 0) {
              if (target.shield >= dealt) {
                target.shield -= dealt;
                dealt = 0;
              } else {
                dealt -= target.shield;
                target.shield = 0;
              }
            }
            target.health -= dealt;

            broadcastToRoom(room, {
              type: 'visualEvent',
              event: { id: `hit-${Date.now()}`, type: 'hit', x: b.x, y: b.y, damage: b.damage, color: target.color },
            });

            if (target.health <= 0) {
              // Tank Killed!
              target.health = 0;
              target.isAlive = false;
              target.deaths++;
              target.streak = 0;
              target.respawnTimer = 3.0;

              const killer = room.players[b.ownerId];
              let streakTitle = '';
              if (killer) {
                killer.kills++;
                killer.streak++;
                killer.score += 100 + killer.streak * 20;

                if (room.gameMode === 'team' && killer.team !== 'none') {
                  room.teamScores[killer.team] += 1;
                }

                if (killer.streak === 2) streakTitle = 'DOUBLE KILL!';
                else if (killer.streak === 3) streakTitle = 'TRIPLE KILL!';
                else if (killer.streak === 5) streakTitle = 'RAMPAGE!';
                else if (killer.streak >= 8) streakTitle = 'UNSTOPPABLE GODLIKE!';
              }

              // Drop powerup where victim died
              const dropType = getRandomPowerupType();
              room.powerups.push({
                id: `pow-drop-${Date.now()}`,
                type: dropType,
                x: target.x,
                y: target.y,
                radius: 18,
                spawnTime: Date.now(),
                durationRemaining: 20,
              });

              // Broadcast Killfeed & Big Death Explosion
              broadcastToRoom(room, {
                type: 'visualEvent',
                event: { id: `death-${Date.now()}`, type: 'explosion', x: target.x, y: target.y, radius: 80, color: '#ef4444' },
              });

              const killItem: KillFeedItem = {
                id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                killerName: killer ? killer.name : 'Unknown',
                killerColor: killer ? killer.color : '#94a3b8',
                victimName: target.name,
                victimColor: target.color,
                weapon: b.type === 'plasma' ? 'Plasma Beam' : b.type === 'sniper' ? 'Railgun' : 'Cannon',
                streakText: streakTitle,
                timestamp: Date.now(),
              };
              broadcastToRoom(room, { type: 'killFeed', item: killItem });
            }

            if (!b.isPiercing) {
              shouldKeep = false;
              break;
            }
          }
        }

        if (!shouldKeep) break;
      }

      if (shouldKeep) {
        remainingBullets.push(b);
      }
    }
    room.bullets = remainingBullets;

    // 5. Update Powerup Pickups
    const remainingPowerups: PowerupItem[] = [];
    for (const p of room.powerups) {
      p.durationRemaining -= DT;
      if (p.durationRemaining <= 0) continue;

      let pickedUp = false;
      for (const tank of Object.values(room.players)) {
        if (!tank.isAlive) continue;
        const dx = tank.x - p.x;
        const dy = tank.y - p.y;
        const distSq = dx * dx + dy * dy;
        const pickRadius = TANK_RADIUS + p.radius;

        if (distSq <= pickRadius * pickRadius) {
          pickedUp = true;
          // Apply powerup
          if (p.type === 'HEALTH_PACK') {
            tank.health = Math.min(tank.health + 45, tank.maxHealth);
          } else if (p.type === 'SHIELD_REPAIR') {
            tank.shield = Math.min(tank.shield + 60, 100);
          } else {
            tank.activePowerup = p.type;
            tank.powerupTimeRemaining = 12.0;
          }
          tank.score += 25;

          broadcastToRoom(room, {
            type: 'visualEvent',
            event: { id: `pickup-${Date.now()}`, type: 'pickup', x: p.x, y: p.y, text: p.type.replace('_', ' ') },
          });
          break;
        }
      }

      if (!pickedUp) {
        remainingPowerups.push(p);
      }
    }
    room.powerups = remainingPowerups;

    // Respawn crates if too few remain
    const brokenCrates = room.obstacles.filter((o) => o.isDestructible && o.health <= 0);
    if (brokenCrates.length > 6 && room.tickCount % 300 === 0) {
      const c = brokenCrates[0];
      c.health = c.maxHealth;
    }

    // 6. Broadcast Game State Snapshot (30 Hz)
    const snapshot: GameStateSnapshot = {
      tick: room.tickCount,
      roomName: room.name,
      gameMode: room.gameMode,
      teamScores: room.gameMode === 'team' ? room.teamScores : undefined,
      players: room.players,
      bullets: room.bullets,
      obstacles: room.obstacles,
      powerups: room.powerups,
      speedPads: room.speedPads,
      arenaWidth: ARENA_WIDTH,
      arenaHeight: ARENA_HEIGHT,
      serverTime: Date.now(),
    };

    broadcastToRoom(room, { type: 'snapshot', state: snapshot });
  }
}, TICK_INTERVAL);

// --- Simple Bot AI Logic ---
function updateBots(room: Room) {
  for (const bot of Object.values(room.players)) {
    if (!bot.isBot || !bot.isAlive) continue;

    // Find nearest visible enemy
    let nearestEnemy: PlayerState | null = null;
    let minEnemyDist = 99999;

    for (const other of Object.values(room.players)) {
      if (other.id === bot.id || !other.isAlive || other.invulnerableTimer > 0) continue;
      if (room.gameMode === 'team' && other.team === bot.team) continue;

      const dx = other.x - bot.x;
      const dy = other.y - bot.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minEnemyDist) {
        minEnemyDist = d;
        nearestEnemy = other;
      }
    }

    const classStats = TANK_CLASSES[bot.tankClass] || TANK_CLASSES.assault;
    const speed = classStats.speed * 0.9;

    if (nearestEnemy) {
      const dx = nearestEnemy.x - bot.x;
      const dy = nearestEnemy.y - bot.y;
      const targetAngle = Math.atan2(dy, dx);

      // Smooth aim
      bot.cannonAngle = targetAngle;

      // Combat maneuvering (circle strafe or advance)
      if (minEnemyDist > 300) {
        bot.vx = Math.cos(targetAngle) * speed;
        bot.vy = Math.sin(targetAngle) * speed;
      } else if (minEnemyDist < 180) {
        // Back up
        bot.vx = -Math.cos(targetAngle) * speed;
        bot.vy = -Math.sin(targetAngle) * speed;
      } else {
        // Strafe perpendicular
        const strafeAngle = targetAngle + Math.PI / 2;
        bot.vx = Math.cos(strafeAngle) * speed;
        bot.vy = Math.sin(strafeAngle) * speed;
      }

      bot.bodyAngle = Math.atan2(bot.vy, bot.vx);

      // Shoot at enemy with periodic cadence
      const now = Date.now();
      const lastShot = room.lastShootTime[bot.id] || 0;
      if (now - lastShot >= classStats.reloadTime * 1.3 && minEnemyDist < 600) {
        room.lastShootTime[bot.id] = now;
        fireBullet(room, bot);
      }
    } else {
      // Idle patrol / look for crates or powerups
      if (room.powerups.length > 0) {
        const p = room.powerups[0];
        const dx = p.x - bot.x;
        const dy = p.y - bot.y;
        const ang = Math.atan2(dy, dx);
        bot.vx = Math.cos(ang) * speed * 0.7;
        bot.vy = Math.sin(ang) * speed * 0.7;
        bot.cannonAngle = ang;
        bot.bodyAngle = ang;
      } else {
        // Wandering
        if (room.tickCount % 60 === 0) {
          bot.bodyAngle += (Math.random() - 0.5) * 1.5;
        }
        bot.vx = Math.cos(bot.bodyAngle) * speed * 0.5;
        bot.vy = Math.sin(bot.bodyAngle) * speed * 0.5;
        bot.cannonAngle = bot.bodyAngle;
      }
    }
  }
}

// --- Serve Static Assets / Vite ---
async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[TankBlitz IO] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
