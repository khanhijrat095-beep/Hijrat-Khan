import React, { useState, useEffect, useRef } from 'react';
import {
  PlayerState,
  KillFeedItem,
  ChatMessage,
  TANK_CLASSES,
  TankClassId,
  PowerupType,
} from '../types/game';
import {
  Volume2,
  VolumeX,
  Share2,
  Check,
  Bot,
  MessageSquare,
  Shield,
  Zap,
  Crosshair,
  Crown,
  Users,
  Flame,
  Radio,
  Settings,
} from 'lucide-react';
import { soundEngine } from '../game/audio';

interface GameHUDProps {
  myPlayer: PlayerState | null;
  players: Record<string, PlayerState>;
  killFeed: KillFeedItem[];
  chatMessages: ChatMessage[];
  pingMs: number;
  roomId: string;
  roomName: string;
  gameMode: 'deathmatch' | 'team';
  teamScores?: { blue: number; red: number };
  onSendChat: (text: string) => void;
  onSendEmote: (emoji: string) => void;
  onTriggerAbility: () => void;
  onAddBot: () => void;
  onClearBots: () => void;
  onOpenSettings: () => void;
  onRespawn: () => void;
}

const EMOTES = ['👑', '🎯', '💥', '🛡️', '⚡', '😂', '💀', '🔥'];

export const GameHUD: React.FC<GameHUDProps> = ({
  myPlayer,
  players,
  killFeed,
  chatMessages,
  pingMs,
  roomId,
  roomName,
  gameMode,
  teamScores,
  onSendChat,
  onSendEmote,
  onTriggerAbility,
  onAddBot,
  onClearBots,
  onOpenSettings,
  onRespawn,
}) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEngine.isSoundMuted());
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Global key listener for Enter (chat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (!chatOpen) {
          setChatOpen(true);
          setTimeout(() => chatInputRef.current?.focus(), 50);
        } else {
          handleChatSubmit();
        }
      }
      if (e.key === 'Escape' && chatOpen) {
        setChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatOpen, chatText]);

  const handleChatSubmit = () => {
    if (chatText.trim()) {
      onSendChat(chatText);
      setChatText('');
    }
    setChatOpen(false);
  };

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleSound = () => {
    const next = soundEngine.toggleMute();
    setIsMuted(next);
  };

  // Sorted leaderboard
  const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
  const classStats = myPlayer ? TANK_CLASSES[myPlayer.tankClass] : null;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 select-none">
      {/* --- TOP BAR --- */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: Room Info & Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {/* Room Badge */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/85 px-3 py-1.5 backdrop-blur-md shadow-lg shadow-black/40">
            <Radio className="h-4 w-4 animate-pulse text-sky-400" />
            <div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {gameMode === 'team' ? 'Team Clash' : 'Deathmatch Arena'}
              </div>
              <div className="font-['Orbitron'] text-xs font-bold text-white tracking-wide">
                {roomName || roomId}
              </div>
            </div>
            <button
              onClick={handleCopyLink}
              title="Copy Room Link to Invite Friends"
              className="ml-1 flex items-center gap-1 rounded bg-sky-500/20 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-500/30 transition-colors"
            >
              {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3" />}
              {copiedLink ? 'Copied!' : 'Invite'}
            </button>
          </div>

          {/* Quick Audio & Settings buttons */}
          <button
            onClick={toggleSound}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-md backdrop-blur-md"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-sky-400" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-md backdrop-blur-md"
            title="Controls & Instructions"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Bot controls button */}
          <div className="flex items-center gap-1">
            <button
              onClick={onAddBot}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-md backdrop-blur-md"
              title="Spawn training AI bot into arena"
            >
              <Bot className="h-3.5 w-3.5 text-amber-400" />
              <span>+Bot</span>
            </button>
            <button
              onClick={onClearBots}
              className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900/80 px-2 py-1.5 text-[11px] font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors shadow-md backdrop-blur-md"
              title="Clear all AI bots"
            >
              Clear
            </button>
          </div>

          {/* Ping indicator */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] font-mono text-slate-400 backdrop-blur-sm">
            <div
              className={`h-2 w-2 rounded-full ${
                pingMs < 80 ? 'bg-emerald-400' : pingMs < 160 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
            />
            <span>{pingMs}ms</span>
          </div>
        </div>

        {/* Center: Team Scores (if team mode) */}
        {gameMode === 'team' && teamScores && (
          <div className="pointer-events-auto flex items-center rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-1.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 font-['Orbitron'] font-bold text-sky-400">
              <span className="text-xs tracking-wider text-sky-300">BLUE</span>
              <span className="text-xl">{teamScores.blue}</span>
            </div>
            <div className="mx-3 text-slate-500 font-bold">:</div>
            <div className="flex items-center gap-2 font-['Orbitron'] font-bold text-rose-400">
              <span className="text-xl">{teamScores.red}</span>
              <span className="text-xs tracking-wider text-rose-300">RED</span>
            </div>
          </div>
        )}

        {/* Right: Leaderboard & Killfeed */}
        <div className="flex flex-col items-end gap-2">
          {/* Real-time Scoreboard */}
          <div className="pointer-events-auto w-56 rounded-xl border border-slate-800/80 bg-slate-900/85 p-2.5 shadow-xl backdrop-blur-md">
            <div className="mb-1.5 flex items-center justify-between border-b border-slate-800 pb-1 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              <span className="flex items-center gap-1">
                <Crown className="h-3 w-3 text-amber-400" /> Leaderboard
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <Users className="h-3 w-3" /> {Object.keys(players).length}
              </span>
            </div>
            <div className="space-y-1">
              {sortedPlayers.slice(0, 5).map((p, idx) => {
                const isMe = p.id === myPlayer?.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded px-1.5 py-0.5 text-xs transition-colors ${
                      isMe ? 'bg-sky-500/20 font-bold text-sky-300' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="w-3 text-[10px] text-slate-500 font-mono">{idx + 1}</span>
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="truncate max-w-[100px]">{p.name}</span>
                      {p.streak >= 2 && (
                        <span className="text-[10px] text-amber-400 flex items-center">
                          <Flame className="h-2.5 w-2.5" />
                          {p.streak}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-200">
                      {p.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Killfeed sliding ticker */}
          <div className="flex flex-col gap-1 items-end pointer-events-none">
            {killFeed.slice(-4).map((kf) => (
              <div
                key={kf.id}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/90 px-2.5 py-1 text-[11px] text-slate-200 shadow-lg backdrop-blur-md animate-fade-in"
              >
                <span className="font-semibold" style={{ color: kf.killerColor }}>
                  {kf.killerName}
                </span>
                <span className="text-[10px] text-slate-500">[{kf.weapon}]</span>
                <span className="font-semibold" style={{ color: kf.victimColor }}>
                  {kf.victimName}
                </span>
                {kf.streakText && (
                  <span className="rounded bg-rose-500/20 px-1 py-0.5 text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                    {kf.streakText}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- DEAD / RESPAWNING OVERLAY --- */}
      {myPlayer && !myPlayer.isAlive && (
        <div className="pointer-events-auto mx-auto flex flex-col items-center justify-center rounded-2xl border border-rose-500/40 bg-slate-950/90 p-6 text-center shadow-2xl backdrop-blur-lg">
          <div className="text-sm font-semibold tracking-widest text-rose-400 uppercase">
            HULL BREACHED • DESTROYED
          </div>
          <div className="my-2 font-['Orbitron'] text-3xl font-extrabold text-white">
            {myPlayer.respawnTimer > 0
              ? `Rebuilding: ${Math.ceil(myPlayer.respawnTimer)}s`
              : 'READY TO DEPLOY'}
          </div>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            Energy shields recharging. You will redeploy with a 3.5s invulnerability defense matrix.
          </p>
          <button
            onClick={onRespawn}
            disabled={myPlayer.respawnTimer > 0}
            className={`rounded-xl px-6 py-2.5 font-['Orbitron'] text-sm font-bold tracking-wider uppercase transition-all shadow-lg ${
              myPlayer.respawnTimer > 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
            }`}
          >
            Deploy Tank Now
          </button>
        </div>
      )}

      {/* --- BOTTOM SECTION --- */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom Left: Chat Box */}
        <div className="pointer-events-auto w-72 rounded-xl border border-slate-800/80 bg-slate-900/85 p-2 shadow-xl backdrop-blur-md flex flex-col">
          <div
            ref={chatContainerRef}
            className="h-28 overflow-y-auto space-y-1.5 pr-1 text-xs scrollbar-thin scrollbar-thumb-slate-700"
          >
            {chatMessages.slice(-15).map((msg) => (
              <div key={msg.id} className="leading-snug break-words">
                {msg.isSystem ? (
                  <span className="text-[11px] italic text-slate-400">⚡ {msg.text}</span>
                ) : (
                  <>
                    <span className="font-semibold" style={{ color: msg.senderColor }}>
                      {msg.senderName}:
                    </span>{' '}
                    <span className="text-slate-200">{msg.text}</span>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Chat input form */}
          {chatOpen ? (
            <div className="mt-1.5 flex gap-1">
              <input
                ref={chatInputRef}
                type="text"
                maxLength={90}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Press Enter to send..."
                className="w-full rounded bg-slate-800/90 px-2 py-1 text-xs text-white placeholder-slate-500 outline-none border border-sky-500/50"
              />
              <button
                onClick={handleChatSubmit}
                className="rounded bg-sky-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400"
              >
                Send
              </button>
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              <span>Press [Enter] to chat...</span>
            </button>
          )}
        </div>

        {/* Bottom Center: Player Combat HUD */}
        {myPlayer && myPlayer.isAlive && classStats && (
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {/* Active Powerup Banner */}
            {myPlayer.activePowerup && (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/60 bg-amber-500/20 px-3 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md animate-pulse">
                <Zap className="h-3.5 w-3.5" />
                <span>{myPlayer.activePowerup.replace('_', ' ')}</span>
                <span className="text-[10px] text-amber-200">
                  ({myPlayer.powerupTimeRemaining.toFixed(1)}s)
                </span>
              </div>
            )}

            {/* Combat Status Capsule */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-lg">
              {/* Health & Shield Gauge */}
              <div className="w-52 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Crosshair className="h-3 w-3 text-emerald-400" /> HP
                  </span>
                  <span className="text-white">
                    {Math.round(myPlayer.health)} / {myPlayer.maxHealth}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${(myPlayer.health / myPlayer.maxHealth) * 100}%`,
                      backgroundColor:
                        myPlayer.health > 50 ? '#10b981' : myPlayer.health > 25 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>

                {/* Shield Bar if active */}
                {myPlayer.shield > 0 && (
                  <div className="pt-0.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-sky-400">
                      <span className="flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" /> SHIELD
                      </span>
                      <span>{Math.round(myPlayer.shield)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-sky-400 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (myPlayer.shield / 100) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="h-10 w-px bg-slate-800" />

              {/* Class Ability Action Button */}
              <div className="flex flex-col items-center">
                <button
                  onClick={onTriggerAbility}
                  disabled={myPlayer.abilityCooldownRemaining > 0}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
                    myPlayer.abilityCooldownRemaining <= 0
                      ? 'border-sky-400 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 hover:scale-105 shadow-lg shadow-sky-500/20 cursor-pointer'
                      : 'border-slate-800 bg-slate-800/40 text-slate-500 cursor-not-allowed'
                  }`}
                  title={`${classStats.abilityName} [SHIFT or SPACE]: ${classStats.abilityDesc}`}
                >
                  <Zap className="h-5 w-5" />
                  {myPlayer.abilityCooldownRemaining > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-white bg-slate-950/70 rounded-xl">
                      {Math.ceil(myPlayer.abilityCooldownRemaining)}s
                    </div>
                  )}
                </button>
                <span className="mt-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  [SPACE]
                </span>
              </div>

              {/* Emote Selector Button */}
              <div className="relative">
                <button
                  onClick={() => setShowEmotes(!showEmotes)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-xl hover:bg-slate-700 transition-colors"
                  title="Broadcast Emote [E]"
                >
                  😎
                </button>

                {/* Floating Emote Wheel */}
                {showEmotes && (
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-1 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-lg">
                    {EMOTES.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onSendEmote(emoji);
                          setShowEmotes(false);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-slate-800 hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Right: Quick Controls Hint */}
        <div className="pointer-events-none hidden md:flex flex-col items-end text-[11px] text-slate-400 space-y-0.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 backdrop-blur-sm">
          <div><span className="font-semibold text-slate-200">WASD / Arrow Keys</span>: Move Tank</div>
          <div><span className="font-semibold text-slate-200">Mouse</span>: Aim Turret & Fire (Hold Left Click)</div>
          <div><span className="font-semibold text-slate-200">Space / Shift</span>: Class Special Ability</div>
          <div><span className="font-semibold text-slate-200">E</span>: Quick Emote Wheel</div>
        </div>
      </div>
    </div>
  );
};
