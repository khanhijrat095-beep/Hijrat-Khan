export type TankClassId = 'assault' | 'scout' | 'titan' | 'sniper';

export interface TankClassStats {
  id: TankClassId;
  name: string;
  tagline: string;
  maxHealth: number;
  speed: number;
  reloadTime: number; // ms
  damage: number;
  bulletSpeed: number;
  bulletRadius: number;
  bulletBounces: number;
  abilityName: string;
  abilityDesc: string;
  abilityCooldown: number; // ms
}

export const TANK_CLASSES: Record<TankClassId, TankClassStats> = {
  assault: {
    id: 'assault',
    name: 'Assault Apex',
    tagline: 'Balanced combat warrior with tactical dash propulsion',
    maxHealth: 100,
    speed: 4.2,
    reloadTime: 380,
    damage: 24,
    bulletSpeed: 12,
    bulletRadius: 5,
    bulletBounces: 1,
    abilityName: 'Hyper Dash',
    abilityDesc: 'Instant kinetic burst forward, dodging incoming shells',
    abilityCooldown: 4000,
  },
  scout: {
    id: 'scout',
    name: 'Scout Phantom',
    tagline: 'High agility twin-blaster with overclocked overdrive',
    maxHealth: 75,
    speed: 5.4,
    reloadTime: 230,
    damage: 16,
    bulletSpeed: 13.5,
    bulletRadius: 4,
    bulletBounces: 1,
    abilityName: 'Overdrive',
    abilityDesc: '+45% movement speed and +30% reload rate for 3.5s',
    abilityCooldown: 7000,
  },
  titan: {
    id: 'titan',
    name: 'Titan Dreadnought',
    tagline: 'Heavy armored juggernaut with magnetic barrier defense',
    maxHealth: 160,
    speed: 3.3,
    reloadTime: 580,
    damage: 42,
    bulletSpeed: 10,
    bulletRadius: 7,
    bulletBounces: 1,
    abilityName: 'Aegis Barrier',
    abilityDesc: 'Deploys a 90 HP energy shield absorbing all fire for 4s',
    abilityCooldown: 9000,
  },
  sniper: {
    id: 'sniper',
    name: 'Viper Railgun',
    tagline: 'Long-range precision ballistics with shockwave blast',
    maxHealth: 85,
    speed: 3.8,
    reloadTime: 850,
    damage: 65,
    bulletSpeed: 17,
    bulletRadius: 5.5,
    bulletBounces: 2,
    abilityName: 'EMP Shockwave',
    abilityDesc: 'Radial electromagnetic burst that stuns & repels nearby tanks',
    abilityCooldown: 8000,
  },
};

export type PowerupType =
  | 'TRIPLE_SHOT'
  | 'SPEED_BOOST'
  | 'PLASMA_CANNON'
  | 'SHIELD_REPAIR'
  | 'HEALTH_PACK'
  | 'BOUNCE_OVERCHARGE';

export interface PowerupItem {
  id: string;
  type: PowerupType;
  x: number;
  y: number;
  radius: number;
  spawnTime: number;
  durationRemaining: number;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDestructible: boolean;
  health: number;
  maxHealth: number;
  color?: string;
}

export interface SpeedPad {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dirX: number;
  dirY: number;
  boostMultiplier: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  tankClass: TankClassId;
  team: 'none' | 'blue' | 'red';
  x: number;
  y: number;
  vx: number;
  vy: number;
  bodyAngle: number;
  cannonAngle: number;
  health: number;
  maxHealth: number;
  shield: number;
  isAlive: boolean;
  respawnTimer: number;
  invulnerableTimer: number;
  score: number;
  kills: number;
  deaths: number;
  streak: number;
  activePowerup: PowerupType | null;
  powerupTimeRemaining: number;
  abilityCooldownRemaining: number;
  isBot: boolean;
  recentEmote: { emoji: string; timestamp: number } | null;
}

export interface BulletState {
  id: string;
  ownerId: string;
  ownerName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  color: string;
  bouncesLeft: number;
  isPiercing: boolean;
  type: 'standard' | 'plasma' | 'sniper' | 'emp';
  lifeTime: number;
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  killerColor: string;
  victimName: string;
  victimColor: string;
  weapon: string;
  streakText?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface VisualImpactEvent {
  id: string;
  type: 'explosion' | 'hit' | 'pickup' | 'ability' | 'bounce';
  x: number;
  y: number;
  radius?: number;
  color?: string;
  damage?: number;
  text?: string;
}

export interface GameRoomSummary {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: 'deathmatch' | 'team';
}

export interface GameStateSnapshot {
  tick: number;
  roomName: string;
  gameMode: 'deathmatch' | 'team';
  teamScores?: { blue: number; red: number };
  players: Record<string, PlayerState>;
  bullets: BulletState[];
  obstacles: Obstacle[];
  powerups: PowerupItem[];
  speedPads: SpeedPad[];
  arenaWidth: number;
  arenaHeight: number;
  serverTime: number;
}

export interface ClientInputPacket {
  moveX: number;
  moveY: number;
  cannonAngle: number;
  isShooting: boolean;
  triggerAbility?: boolean;
  tick: number;
}

export type ClientMessage =
  | { type: 'join'; name: string; tankClass: TankClassId; color: string; roomId?: string; team?: 'none' | 'blue' | 'red'; mode?: 'deathmatch' | 'team' }
  | { type: 'input'; input: ClientInputPacket }
  | { type: 'emote'; emoji: string }
  | { type: 'chat'; text: string }
  | { type: 'respawn' }
  | { type: 'addBot'; classId?: TankClassId }
  | { type: 'removeBots' }
  | { type: 'ping'; timestamp: number };

export type ServerMessage =
  | { type: 'welcome'; playerId: string; arenaWidth: number; arenaHeight: number; roomId: string; roomList: GameRoomSummary[] }
  | { type: 'snapshot'; state: GameStateSnapshot }
  | { type: 'killFeed'; item: KillFeedItem }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'visualEvent'; event: VisualImpactEvent }
  | { type: 'pong'; timestamp: number }
  | { type: 'roomList'; rooms: GameRoomSummary[] };
