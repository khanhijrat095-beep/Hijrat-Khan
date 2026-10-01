import { Obstacle, SpeedPad, PowerupType } from '../types/game';

export const ARENA_WIDTH = 2400;
export const ARENA_HEIGHT = 2400;
export const TANK_RADIUS = 26;

export function generateDefaultArena(): { obstacles: Obstacle[]; speedPads: SpeedPad[] } {
  const obstacles: Obstacle[] = [];
  const speedPads: SpeedPad[] = [];

  // Outer Border Walls
  const wallThickness = 40;
  obstacles.push(
    // Top
    { id: 'wall-top', x: 0, y: 0, width: ARENA_WIDTH, height: wallThickness, isDestructible: false, health: 9999, maxHealth: 9999 },
    // Bottom
    { id: 'wall-bottom', x: 0, y: ARENA_HEIGHT - wallThickness, width: ARENA_WIDTH, height: wallThickness, isDestructible: false, health: 9999, maxHealth: 9999 },
    // Left
    { id: 'wall-left', x: 0, y: 0, width: wallThickness, height: ARENA_HEIGHT, isDestructible: false, health: 9999, maxHealth: 9999 },
    // Right
    { id: 'wall-right', x: ARENA_WIDTH - wallThickness, y: 0, width: wallThickness, height: ARENA_HEIGHT, isDestructible: false, health: 9999, maxHealth: 9999 }
  );

  // Center Fortress / Hex Columns
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;

  // Center pillars
  obstacles.push(
    { id: 'obs-c1', x: cx - 180, y: cy - 180, width: 80, height: 80, isDestructible: false, health: 9999, maxHealth: 9999 },
    { id: 'obs-c2', x: cx + 100, y: cy - 180, width: 80, height: 80, isDestructible: false, health: 9999, maxHealth: 9999 },
    { id: 'obs-c3', x: cx - 180, y: cy + 100, width: 80, height: 80, isDestructible: false, health: 9999, maxHealth: 9999 },
    { id: 'obs-c4', x: cx + 100, y: cy + 100, width: 80, height: 80, isDestructible: false, health: 9999, maxHealth: 9999 }
  );

  // 4 Quadrant Defense Forts (L-shaped and T-shaped blast walls)
  const quads = [
    { x: cx - 600, y: cy - 600 },
    { x: cx + 600, y: cy - 600 },
    { x: cx - 600, y: cy + 600 },
    { x: cx + 600, y: cy + 600 },
  ];

  quads.forEach((q, idx) => {
    // Horizontal barrier
    obstacles.push({
      id: `wall-quad-h-${idx}`,
      x: q.x - 120,
      y: q.y - 20,
      width: 240,
      height: 40,
      isDestructible: false,
      health: 9999,
      maxHealth: 9999,
    });
    // Vertical barrier
    obstacles.push({
      id: `wall-quad-v-${idx}`,
      x: q.x - 20,
      y: q.y - 120,
      width: 40,
      height: 240,
      isDestructible: false,
      health: 9999,
      maxHealth: 9999,
    });
  });

  // Corner Bunkers
  const corners = [
    { x: 300, y: 300 },
    { x: ARENA_WIDTH - 380, y: 300 },
    { x: 300, y: ARENA_HEIGHT - 380 },
    { x: ARENA_WIDTH - 380, y: ARENA_HEIGHT - 380 },
  ];

  corners.forEach((c, idx) => {
    obstacles.push({
      id: `bunker-${idx}`,
      x: c.x,
      y: c.y,
      width: 80,
      height: 80,
      isDestructible: false,
      health: 9999,
      maxHealth: 9999,
    });
  });

  // Destructible Supply Crates (Wooden / Energy Crates with 35 HP)
  const cratePositions = [
    { x: cx - 350, y: cy },
    { x: cx + 310, y: cy },
    { x: cx, y: cy - 350 },
    { x: cx, y: cy + 310 },
    { x: cx - 40, y: cy - 40 }, // Center high-value crate
    { x: 450, y: 450 },
    { x: ARENA_WIDTH - 490, y: 450 },
    { x: 450, y: ARENA_HEIGHT - 490 },
    { x: ARENA_WIDTH - 490, y: ARENA_HEIGHT - 490 },
    { x: cx - 750, y: cy },
    { x: cx + 710, y: cy },
    { x: cx, y: cy - 750 },
    { x: cx, y: cy + 710 },
  ];

  cratePositions.forEach((pos, idx) => {
    obstacles.push({
      id: `crate-${idx}`,
      x: pos.x,
      y: pos.y,
      width: 44,
      height: 44,
      isDestructible: true,
      health: 35,
      maxHealth: 35,
    });
  });

  // Speed Boost Pads
  speedPads.push(
    // Central ring pads pushing outward/inward
    { id: 'pad-1', x: cx - 300, y: cy - 40, width: 80, height: 80, dirX: 1, dirY: 0, boostMultiplier: 1.6 },
    { id: 'pad-2', x: cx + 220, y: cy - 40, width: 80, height: 80, dirX: -1, dirY: 0, boostMultiplier: 1.6 },
    { id: 'pad-3', x: cx - 40, y: cy - 300, width: 80, height: 80, dirX: 0, dirY: 1, boostMultiplier: 1.6 },
    { id: 'pad-4', x: cx - 40, y: cy + 220, width: 80, height: 80, dirX: 0, dirY: -1, boostMultiplier: 1.6 },
    // Perimeter speed runs
    { id: 'pad-5', x: 200, y: cy - 40, width: 80, height: 80, dirX: 0, dirY: 1, boostMultiplier: 1.5 },
    { id: 'pad-6', x: ARENA_WIDTH - 280, y: cy - 40, width: 80, height: 80, dirX: 0, dirY: -1, boostMultiplier: 1.5 }
  );

  return { obstacles, speedPads };
}

// Circle vs Axis-Aligned Bounding Box (AABB)
export function checkCircleRectCollision(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): { collides: boolean; normalX: number; normalY: number; penetration: number } {
  // Find the closest point on the rectangle to the circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  const distX = cx - closestX;
  const distY = cy - closestY;
  const distanceSq = distX * distX + distY * distY;

  if (distanceSq <= r * r) {
    const dist = Math.sqrt(distanceSq);
    if (dist === 0) {
      // Inside box: push out along minimal axis
      const leftDist = cx - rx;
      const rightDist = rx + rw - cx;
      const topDist = cy - ry;
      const bottomDist = ry + rh - cy;
      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
      if (minDist === leftDist) return { collides: true, normalX: -1, normalY: 0, penetration: r };
      if (minDist === rightDist) return { collides: true, normalX: 1, normalY: 0, penetration: r };
      if (minDist === topDist) return { collides: true, normalX: 0, normalY: -1, penetration: r };
      return { collides: true, normalX: 0, normalY: 1, penetration: r };
    }

    const penetration = r - dist;
    const normalX = distX / dist;
    const normalY = distY / dist;
    return { collides: true, normalX, normalY, penetration };
  }

  return { collides: false, normalX: 0, normalY: 0, penetration: 0 };
}

export function resolveTankObstacleCollisions(
  tank: { x: number; y: number; vx: number; vy: number },
  obstacles: Obstacle[],
  radius = TANK_RADIUS
) {
  for (const obs of obstacles) {
    if (obs.isDestructible && obs.health <= 0) continue;
    const res = checkCircleRectCollision(tank.x, tank.y, radius, obs.x, obs.y, obs.width, obs.height);
    if (res.collides) {
      tank.x += res.normalX * res.penetration;
      tank.y += res.normalY * res.penetration;

      // Project velocity off collision normal
      const dot = tank.vx * res.normalX + tank.vy * res.normalY;
      if (dot < 0) {
        tank.vx -= dot * res.normalX;
        tank.vy -= dot * res.normalY;
      }
    }
  }

  // Clamp within outer border
  const pad = 42 + radius;
  if (tank.x < pad) {
    tank.x = pad;
    tank.vx = 0;
  }
  if (tank.x > ARENA_WIDTH - pad) {
    tank.x = ARENA_WIDTH - pad;
    tank.vx = 0;
  }
  if (tank.y < pad) {
    tank.y = pad;
    tank.vy = 0;
  }
  if (tank.y > ARENA_HEIGHT - pad) {
    tank.y = ARENA_HEIGHT - pad;
    tank.vy = 0;
  }
}

export const POWERUP_TYPES: PowerupType[] = [
  'TRIPLE_SHOT',
  'SPEED_BOOST',
  'PLASMA_CANNON',
  'SHIELD_REPAIR',
  'HEALTH_PACK',
  'BOUNCE_OVERCHARGE',
];

export function getRandomPowerupType(): PowerupType {
  const idx = Math.floor(Math.random() * POWERUP_TYPES.length);
  return POWERUP_TYPES[idx];
}
