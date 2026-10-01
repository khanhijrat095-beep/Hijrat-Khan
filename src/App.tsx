/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  GameStateSnapshot,
  PlayerState,
  KillFeedItem,
  ChatMessage,
  VisualImpactEvent,
  ServerMessage,
  ClientMessage,
  GameRoomSummary,
  TankClassId,
  TANK_CLASSES,
} from './types/game';
import { CanvasRenderer } from './game/canvasRenderer';
import { soundEngine } from './game/audio';
import { GameHUD } from './components/GameHUD';
import { LobbyView } from './components/LobbyView';
import { TouchControls } from './components/TouchControls';
import { SettingsModal } from './components/SettingsModal';
import confetti from 'canvas-confetti';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Connection & Game State
  const [isInGame, setIsInGame] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState('arena-alpha');
  const [roomName, setRoomName] = useState('Neo Neo-Tokyo');
  const [gameMode, setGameMode] = useState<'deathmatch' | 'team'>('deathmatch');
  const [teamScores, setTeamScores] = useState<{ blue: number; red: number } | undefined>();
  const [roomList, setRoomList] = useState<GameRoomSummary[]>([]);
  const [pingMs, setPingMs] = useState(25);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Live in-room data
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Ref to hold newest state without triggering re-render on each 30Hz frame
  const latestStateRef = useRef<GameStateSnapshot | null>(null);

  // Input states
  const keysDownRef = useRef<Record<string, boolean>>({});
  const touchMoveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mousePosRef = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 });
  const isShootingRef = useRef(false);
  const touchAimRef = useRef<{ angle: number; isAiming: boolean }>({ angle: 0, isAiming: false });
  const lastShotTimeRef = useRef(0);

  // Initial room query from URL
  const initialRoomQuery = new URLSearchParams(window.location.search).get('room') || 'arena-alpha';

  // --- WebSocket Connection & Handlers ---
  const connectToServer = useCallback(
    (options: {
      name: string;
      tankClass: TankClassId;
      color: string;
      roomId: string;
      mode: 'deathmatch' | 'team';
    }) => {
      if (socketRef.current) {
        socketRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        // Send join packet
        const joinMsg: ClientMessage = {
          type: 'join',
          name: options.name,
          tankClass: options.tankClass,
          color: options.color,
          roomId: options.roomId,
          mode: options.mode,
        };
        ws.send(JSON.stringify(joinMsg));
        setIsInGame(true);
        setCurrentRoomId(options.roomId);
        setGameMode(options.mode);

        // Start ping interval
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          } else {
            clearInterval(pingInterval);
          }
        }, 2000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);

          if (msg.type === 'welcome') {
            setMyPlayerId(msg.playerId);
            setCurrentRoomId(msg.roomId);
            if (msg.roomList) setRoomList(msg.roomList);
          } else if (msg.type === 'snapshot') {
            latestStateRef.current = msg.state;
            setPlayers(msg.state.players);
            setRoomName(msg.state.roomName);
            if (msg.state.teamScores) {
              setTeamScores(msg.state.teamScores);
            }
          } else if (msg.type === 'killFeed') {
            setKillFeed((prev) => [...prev.slice(-10), msg.item]);
            soundEngine.playKillCue(msg.item.streakText ? 3 : 1);

            // Confetti if player got a rampage or streak
            if (msg.item.streakText && msg.item.killerName) {
              confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.2 },
              });
            }
          } else if (msg.type === 'chat') {
            setChatMessages((prev) => [...prev.slice(-30), msg.message]);
          } else if (msg.type === 'visualEvent') {
            if (rendererRef.current) {
              rendererRef.current.addVisualEvent(msg.event);
            }
            // Trigger matching sound effects
            if (msg.event.type === 'explosion') {
              soundEngine.playExplosion(msg.event.radius && msg.event.radius > 60 ? 'death' : 'large');
            } else if (msg.event.type === 'hit') {
              soundEngine.playHit();
            } else if (msg.event.type === 'bounce') {
              soundEngine.playRicochet();
            } else if (msg.event.type === 'pickup') {
              soundEngine.playPowerup();
            } else if (msg.event.type === 'ability') {
              soundEngine.playAbility('ability');
            }
          } else if (msg.type === 'pong') {
            const now = Date.now();
            setPingMs(Math.max(10, now - msg.timestamp));
          } else if (msg.type === 'roomList') {
            setRoomList(msg.rooms);
          }
        } catch {
          // ignore malformed packets
        }
      };

      ws.onclose = () => {
        // Disconnected
      };
    },
    []
  );

  // --- Send Client Inputs (30 Hz) ---
  useEffect(() => {
    if (!isInGame) return;

    let inputTick = 0;
    const interval = setInterval(() => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const state = latestStateRef.current;
      const myPlayer = myPlayerId && state ? state.players[myPlayerId] : null;

      // Calculate move vector from keyboard + touch
      let moveX = touchMoveRef.current.x;
      let moveY = touchMoveRef.current.y;

      if (keysDownRef.current['KeyW'] || keysDownRef.current['ArrowUp']) moveY -= 1;
      if (keysDownRef.current['KeyS'] || keysDownRef.current['ArrowDown']) moveY += 1;
      if (keysDownRef.current['KeyA'] || keysDownRef.current['ArrowLeft']) moveX -= 1;
      if (keysDownRef.current['KeyD'] || keysDownRef.current['ArrowRight']) moveX += 1;

      // Calculate aim angle
      let cannonAngle = 0;
      if (touchAimRef.current.isAiming) {
        cannonAngle = touchAimRef.current.angle;
      } else if (myPlayer && canvasRef.current) {
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const screenCenterX = viewW / 2;
        const screenCenterY = viewH / 2;
        const dx = mousePosRef.current.screenX - screenCenterX;
        const dy = mousePosRef.current.screenY - screenCenterY;
        cannonAngle = Math.atan2(dy, dx);
      }

      // Check shooting
      const isShooting = isShootingRef.current || touchAimRef.current.isAiming;
      if (isShooting && myPlayer && myPlayer.isAlive) {
        const now = Date.now();
        const classStats = TANK_CLASSES[myPlayer.tankClass] || TANK_CLASSES.assault;
        if (now - lastShotTimeRef.current >= classStats.reloadTime * 0.9) {
          lastShotTimeRef.current = now;
          soundEngine.playShoot(
            myPlayer.activePowerup === 'PLASMA_CANNON'
              ? 'plasma'
              : myPlayer.tankClass === 'sniper'
              ? 'sniper'
              : myPlayer.tankClass === 'scout'
              ? 'rapid'
              : myPlayer.tankClass === 'titan'
              ? 'heavy'
              : 'standard'
          );
        }
      }

      // Dynamic engine hum modulation
      if (myPlayer && myPlayer.isAlive) {
        const speed = Math.sqrt(myPlayer.vx * myPlayer.vx + myPlayer.vy * myPlayer.vy);
        soundEngine.updateEngineSound(speed / 6.0);
      }

      inputTick++;
      const packet: ClientMessage = {
        type: 'input',
        input: {
          moveX,
          moveY,
          cannonAngle,
          isShooting,
          tick: inputTick,
        },
      };

      ws.send(JSON.stringify(packet));
    }, 33.3);

    return () => clearInterval(interval);
  }, [isInGame, myPlayerId]);

  // --- Keyboard & Mouse Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      keysDownRef.current[e.code] = true;

      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        triggerAbility();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { screenX: e.clientX, screenY: e.clientY };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.button === 0) {
        isShootingRef.current = true;
        soundEngine.ensureActive();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isShootingRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- Trigger Class Ability ---
  const triggerAbility = () => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    soundEngine.ensureActive();
    ws.send(
      JSON.stringify({
        type: 'input',
        input: {
          moveX: 0,
          moveY: 0,
          cannonAngle: 0,
          isShooting: false,
          triggerAbility: true,
          tick: 0,
        },
      })
    );
  };

  // --- Main 60-120 FPS Canvas Render Loop ---
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const renderer = new CanvasRenderer(canvas);
    rendererRef.current = renderer;

    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;

    const renderLoop = () => {
      const state = latestStateRef.current;
      if (state) {
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const myPlayer = myPlayerId ? state.players[myPlayerId] : null;

        // Calculate world coordinates for mouse
        let mouseWorldX = 0;
        let mouseWorldY = 0;
        let reloadPct = 1.0;

        if (myPlayer) {
          const dx = mousePosRef.current.screenX - viewW / 2;
          const dy = mousePosRef.current.screenY - viewH / 2;
          mouseWorldX = myPlayer.x + dx;
          mouseWorldY = myPlayer.y + dy;

          const classStats = TANK_CLASSES[myPlayer.tankClass] || TANK_CLASSES.assault;
          const timeSinceShot = Date.now() - lastShotTimeRef.current;
          reloadPct = Math.min(1.0, timeSinceShot / classStats.reloadTime);
        }

        renderer.render(
          state,
          myPlayerId,
          viewW,
          viewH,
          mouseWorldX,
          mouseWorldY,
          reloadPct
        );
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [myPlayerId]);

  // Actions for GameHUD
  const handleSendChat = (text: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'chat', text }));
    }
  };

  const handleSendEmote = (emoji: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'emote', emoji }));
    }
  };

  const handleAddBot = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'addBot' }));
    }
  };

  const handleClearBots = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'removeBots' }));
    }
  };

  const handleRespawn = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'respawn' }));
    }
  };

  const myPlayer = myPlayerId ? players[myPlayerId] || null : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070b13] select-none">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
      />

      {/* Lobby Overlay before joining */}
      {!isInGame && (
        <LobbyView
          onJoin={connectToServer}
          roomList={roomList}
          initialRoomId={initialRoomQuery}
        />
      )}

      {/* In-Game HUD & Tactical Controls */}
      {isInGame && (
        <>
          <GameHUD
            myPlayer={myPlayer}
            players={players}
            killFeed={killFeed}
            chatMessages={chatMessages}
            pingMs={pingMs}
            roomId={currentRoomId}
            roomName={roomName}
            gameMode={gameMode}
            teamScores={teamScores}
            onSendChat={handleSendChat}
            onSendEmote={handleSendEmote}
            onTriggerAbility={triggerAbility}
            onAddBot={handleAddBot}
            onClearBots={handleClearBots}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onRespawn={handleRespawn}
          />

          {/* Virtual Touch Joysticks for mobile */}
          <TouchControls
            onMoveChange={(x, y) => {
              touchMoveRef.current = { x, y };
            }}
            onAimChange={(angle, isAiming) => {
              touchAimRef.current = { angle, isAiming };
            }}
            onTriggerAbility={triggerAbility}
          />
        </>
      )}

      {/* Tactical Settings & Guide Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
