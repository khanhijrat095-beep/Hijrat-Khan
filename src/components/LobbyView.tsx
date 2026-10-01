import React, { useState } from 'react';
import { TankClassId, TANK_CLASSES, GameRoomSummary } from '../types/game';
import {
  Shield,
  Zap,
  Target,
  Crosshair,
  Volume2,
  VolumeX,
  Sparkles,
  Gamepad2,
  Users,
  Play,
  Dice5,
  Swords,
} from 'lucide-react';
import { soundEngine } from '../game/audio';

interface LobbyViewProps {
  onJoin: (options: {
    name: string;
    tankClass: TankClassId;
    color: string;
    roomId: string;
    mode: 'deathmatch' | 'team';
  }) => void;
  roomList: GameRoomSummary[];
  initialRoomId?: string;
}

const TANK_COLORS = [
  { name: 'Cyber Cyan', hex: '#38bdf8' },
  { name: 'Neon Purple', hex: '#a855f7' },
  { name: 'Solar Gold', hex: '#f59e0b' },
  { name: 'Toxic Lime', hex: '#10b981' },
  { name: 'Crimson Fury', hex: '#ef4444' },
  { name: 'Electric Pink', hex: '#ec4899' },
];

const RANDOM_NAMES = [
  'Vanguard',
  'GhostRider',
  'IronClad',
  'NeonReaper',
  'CyberWolf',
  'Thunderbolt',
  'Solaris',
  'ApexPredator',
  'ShadowStrike',
  'HyperNova',
];

export const LobbyView: React.FC<LobbyViewProps> = ({
  onJoin,
  roomList,
  initialRoomId,
}) => {
  const [name, setName] = useState(() => {
    return 'Commander_' + Math.floor(100 + Math.random() * 900);
  });
  const [selectedClass, setSelectedClass] = useState<TankClassId>('assault');
  const [selectedColor, setSelectedColor] = useState(TANK_COLORS[0].hex);
  const [selectedRoom, setSelectedRoom] = useState(initialRoomId || 'arena-alpha');
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [gameMode, setGameMode] = useState<'deathmatch' | 'team'>('deathmatch');
  const [isMuted, setIsMuted] = useState(soundEngine.isSoundMuted());

  const currentStats = TANK_CLASSES[selectedClass];

  const handleRandomizeName = () => {
    const randomPick = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setName(`${randomPick}_${Math.floor(10 + Math.random() * 90)}`);
  };

  const handleStartGame = () => {
    soundEngine.ensureActive();
    soundEngine.playShoot('standard');

    const finalRoomId = customRoomInput.trim()
      ? customRoomInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
      : selectedRoom;

    onJoin({
      name: name.trim() || 'Commander',
      tankClass: selectedClass,
      color: selectedColor,
      roomId: finalRoomId,
      mode: gameMode,
    });
  };

  const toggleSound = () => {
    const next = soundEngine.toggleMute();
    setIsMuted(next);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[#070b13] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.18),rgba(255,255,255,0))] overflow-y-auto">
      {/* Background Decorative Tech Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/90 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        {/* Header Title & Branding */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-sky-400 uppercase">
              <Sparkles className="h-4 w-4" /> Real-Time Multiplayer Battle Arena
            </div>
            <h1 className="mt-1 font-['Orbitron'] text-3xl md:text-4xl font-black tracking-wider text-white">
              TANKBLITZ<span className="text-sky-400">.IO</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Engage in high-octane 2D armor warfare with bouncing shells, shields, and custom war chassis.
            </p>
          </div>

          {/* Sound & Status toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-sky-400" />}
              <span>{isMuted ? 'Muted' : 'Audio On'}</span>
            </button>
          </div>
        </div>

        {/* Middle Config Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-6">
          {/* Left Column: Callsign & Class Selection */}
          <div className="md:col-span-7 space-y-5">
            {/* Callsign Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Player Callsign
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={16}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 font-['Orbitron'] text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-sky-400 transition-colors"
                  placeholder="Enter callsign..."
                />
                <button
                  onClick={handleRandomizeName}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
                  title="Randomize Name"
                >
                  <Dice5 className="h-4 w-4 text-sky-400" />
                  <span>Random</span>
                </button>
              </div>
            </div>

            {/* Tank Class Selection Cards */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Select War Machine Class
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.keys(TANK_CLASSES) as TankClassId[]).map((cid) => {
                  const c = TANK_CLASSES[cid];
                  const isSelected = selectedClass === cid;
                  return (
                    <button
                      key={cid}
                      onClick={() => setSelectedClass(cid)}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/10 scale-[1.02]'
                          : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-['Orbitron'] text-xs font-bold text-white">
                          {c.name}
                        </span>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400" />}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {c.tagline}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Neon Armor Color Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Hull Neon Accent
              </label>
              <div className="flex items-center gap-3">
                {TANK_COLORS.map((col) => {
                  const isSelected = selectedColor === col.hex;
                  return (
                    <button
                      key={col.hex}
                      onClick={() => setSelectedColor(col.hex)}
                      className={`h-9 w-9 rounded-xl border-2 transition-transform ${
                        isSelected
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col.hex }}
                      title={col.name}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Class Stats & Arena Room Selector */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-4">
            {/* Class Detailed Stats Panel */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-['Orbitron'] text-sm font-bold text-sky-300">
                  {currentStats.name}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  HP {currentStats.maxHealth}
                </span>
              </div>

              {/* Stat Bars */}
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 mb-0.5">
                    <span>Speed</span>
                    <span className="font-mono text-slate-200">{currentStats.speed * 10}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${(currentStats.speed / 6.0) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-0.5">
                    <span>Shell Firepower</span>
                    <span className="font-mono text-slate-200">{currentStats.damage}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-400 rounded-full"
                      style={{ width: `${(currentStats.damage / 70) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-0.5">
                    <span>Reload Speed</span>
                    <span className="font-mono text-slate-200">{(1000 / currentStats.reloadTime).toFixed(1)} /s</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${Math.min(100, (600 / currentStats.reloadTime) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Special Ability Pill */}
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Special: {currentStats.abilityName}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                  {currentStats.abilityDesc}
                </div>
              </div>
            </div>

            {/* Room & Game Mode Selector */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Choose Lobby / Arena
              </label>

              {/* Quick Preset Lobbies */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSelectedRoom('arena-alpha');
                    setGameMode('deathmatch');
                    setCustomRoomInput('');
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedRoom === 'arena-alpha' && !customRoomInput
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold font-['Orbitron'] flex items-center gap-1">
                    <Swords className="h-3 w-3 text-sky-400" /> Free For All
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Neo-Tokyo Arena</div>
                </button>

                <button
                  onClick={() => {
                    setSelectedRoom('arena-beta');
                    setGameMode('team');
                    setCustomRoomInput('');
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedRoom === 'arena-beta' && !customRoomInput
                      ? 'border-rose-400 bg-rose-500/20 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold font-['Orbitron'] flex items-center gap-1">
                    <Users className="h-3 w-3 text-rose-400" /> Red vs Blue
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Team Clash</div>
                </button>
              </div>

              {/* Custom Room Code */}
              <div>
                <input
                  type="text"
                  placeholder="Or enter private room code..."
                  value={customRoomInput}
                  onChange={(e) => setCustomRoomInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Play Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-6">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Gamepad2 className="h-4 w-4 text-sky-400 shrink-0" />
            <span>
              Controls: <strong className="text-white">WASD</strong> to Drive,{' '}
              <strong className="text-white">Mouse</strong> to Aim & Shoot,{' '}
              <strong className="text-white">Space</strong> for Ability
            </span>
          </div>

          <button
            onClick={handleStartGame}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 px-8 py-3.5 font-['Orbitron'] text-sm font-black tracking-wider text-slate-950 uppercase shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Play className="h-4 w-4 fill-slate-950" />
            <span>Launch Into Combat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
