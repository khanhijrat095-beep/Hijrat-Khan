import React, { useState } from 'react';
import { X, Volume2, VolumeX, Shield, Zap, Target, Sparkles, HelpCircle } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [isMuted, setIsMuted] = useState(soundEngine.isSoundMuted());
  const [volume, setVolume] = useState(60);

  if (!isOpen) return null;

  const handleToggleMute = () => {
    const next = soundEngine.toggleMute();
    setIsMuted(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    soundEngine.setVolume(val / 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-sky-400" />
            <h2 className="font-['Orbitron'] text-lg font-bold text-white">
              Tactical Field Manual & Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-5 text-xs text-slate-300">
          {/* Audio Settings */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-sky-400" />}
                Sound Effects Synthesizer
              </span>
              <button
                onClick={handleToggleMute}
                className="rounded bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-semibold text-sky-300 hover:bg-slate-700"
              >
                {isMuted ? 'UNMUTE' : 'MUTE'}
              </button>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Master Volume</span>
                <span>{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Combat Tactics & Rules */}
          <div className="space-y-2.5">
            <div className="font-semibold text-sky-300 font-['Orbitron'] text-xs tracking-wider uppercase">
              Combat Mechanics
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
                <div className="font-bold text-slate-100 flex items-center gap-1.5 mb-1">
                  <Target className="h-3.5 w-3.5 text-amber-400" /> Ricochet Physics
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Standard cannon shells bounce off metallic walls! Use banking angles to hit enemies behind obstacles.
                </p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
                <div className="font-bold text-slate-100 flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Supply Crates
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Blast wooden crates to acquire random power-ups (Triple Shot, Plasma Laser, Energy Shields, Speed).
                </p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
                <div className="font-bold text-slate-100 flex items-center gap-1.5 mb-1">
                  <Zap className="h-3.5 w-3.5 text-sky-400" /> Speed Boost Pads
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Drive onto glowing green arrow pads to get an instant propulsion boost to chase or evade.
                </p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
                <div className="font-bold text-slate-100 flex items-center gap-1.5 mb-1">
                  <Shield className="h-3.5 w-3.5 text-blue-400" /> Respawn Matrix
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  When deployed, your tank possesses 3.5s of total invulnerability to turn the tide.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-sky-500 hover:bg-sky-400 px-5 py-2 font-['Orbitron'] text-xs font-bold text-slate-950 uppercase transition-colors"
          >
            Dismiss & Resume
          </button>
        </div>
      </div>
    </div>
  );
};
