import React, { useRef, useState } from 'react';
import { Zap, Crosshair } from 'lucide-react';

interface TouchControlsProps {
  onMoveChange: (x: number, y: number) => void;
  onAimChange: (angle: number, shooting: boolean) => void;
  onTriggerAbility: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveChange,
  onAimChange,
  onTriggerAbility,
}) => {
  const leftStickRef = useRef<HTMLDivElement>(null);
  const [leftKnobPos, setLeftKnobPos] = useState({ x: 0, y: 0 });
  const [isLeftActive, setIsLeftActive] = useState(false);

  const rightStickRef = useRef<HTMLDivElement>(null);
  const [rightKnobPos, setRightKnobPos] = useState({ x: 0, y: 0 });
  const [isRightActive, setIsRightActive] = useState(false);

  // Left stick (Driving)
  const handleLeftTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!leftStickRef.current) return;
    const touch = e.touches[0];
    const rect = leftStickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setLeftKnobPos({ x: knobX, y: knobY });
    setIsLeftActive(true);
    onMoveChange(knobX / maxRadius, knobY / maxRadius);
  };

  const handleLeftTouchEnd = () => {
    setLeftKnobPos({ x: 0, y: 0 });
    setIsLeftActive(false);
    onMoveChange(0, 0);
  };

  // Right stick (Aim & Fire)
  const handleRightTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!rightStickRef.current) return;
    const touch = e.touches[0];
    const rect = rightStickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setRightKnobPos({ x: knobX, y: knobY });
    setIsRightActive(true);
    onAimChange(angle, dist > 15);
  };

  const handleRightTouchEnd = () => {
    setRightKnobPos({ x: 0, y: 0 });
    setIsRightActive(false);
    onAimChange(0, false);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex items-end justify-between px-6 md:hidden">
      {/* Left Joystick: Movement */}
      <div
        ref={leftStickRef}
        onTouchStart={handleLeftTouch}
        onTouchMove={handleLeftTouch}
        onTouchEnd={handleLeftTouchEnd}
        className="pointer-events-auto relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-slate-700/60 bg-slate-900/50 backdrop-blur-sm touch-none"
      >
        <div
          className={`h-12 w-12 rounded-full border border-sky-400 bg-sky-500/40 shadow-lg shadow-sky-500/20 transition-transform ${
            isLeftActive ? 'scale-110' : ''
          }`}
          style={{
            transform: `translate(${leftKnobPos.x}px, ${leftKnobPos.y}px)`,
          }}
        />
        <span className="absolute bottom-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          Drive
        </span>
      </div>

      {/* Middle: Touch Ability Button */}
      <div className="pointer-events-auto flex flex-col items-center gap-2 mb-2">
        <button
          onClick={onTriggerAbility}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-400/80 bg-amber-500/20 text-amber-300 shadow-xl shadow-amber-500/20 active:scale-95 transition-transform"
        >
          <Zap className="h-6 w-6" />
        </button>
      </div>

      {/* Right Joystick: Aim & Fire */}
      <div
        ref={rightStickRef}
        onTouchStart={handleRightTouch}
        onTouchMove={handleRightTouch}
        onTouchEnd={handleRightTouchEnd}
        className="pointer-events-auto relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-rose-700/60 bg-slate-900/50 backdrop-blur-sm touch-none"
      >
        <div
          className={`h-12 w-12 rounded-full border border-rose-400 bg-rose-500/40 shadow-lg shadow-rose-500/20 transition-transform ${
            isRightActive ? 'scale-110' : ''
          }`}
          style={{
            transform: `translate(${rightKnobPos.x}px, ${rightKnobPos.y}px)`,
          }}
        >
          <Crosshair className="h-4 w-4 m-auto mt-3.5 text-rose-300" />
        </div>
        <span className="absolute bottom-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          Aim & Fire
        </span>
      </div>
    </div>
  );
};
