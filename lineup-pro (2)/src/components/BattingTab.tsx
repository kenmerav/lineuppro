import React, { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Hash, Save, Play, Square, Music2 } from 'lucide-react';
import { Player, DefenseAssignments } from '../types';
import { ALL_POSITIONS } from '../constants';

interface BattingTabProps {
  players: Player[];
  battingOrder: string[];
  assignments: DefenseAssignments;
  onReorder: (newOrder: string[]) => void;
  onSaveAsGame: () => Promise<void>;
}

interface SortableItemProps {
  id: string;
  player: Player;
  index: number;
  assignments: DefenseAssignments;
  playingPlayerId: string | null;
  onPlayWalkout: (player: Player) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, player, index, assignments, playingPlayerId, onPlayWalkout }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const getPlayerPosition = (inningNum: number) => {
    const inning = assignments.byInning[inningNum];
    if (!inning) return '-';
    
    for (const pos of ALL_POSITIONS) {
      if (inning[pos] === player.id) return pos;
    }
    
    if (inning.dugout.includes(player.id)) return 'Bench';
    
    return '-';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-4 shadow-sm
        ${isDragging ? 'shadow-xl border-indigo-200' : 'hover:border-slate-200'}
        transition-shadow duration-200
      `}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-sm">
            {index + 1}
          </div>
          <div 
            className="w-1.5 h-8 rounded-full" 
            style={{ backgroundColor: player.color }}
          />
          <span className="font-semibold text-slate-800 min-w-[120px]">
            {player.number ? `#${player.number} ` : ''}{player.name}
          </span>
          <button
            onClick={() => onPlayWalkout(player)}
            disabled={!player.walkoutSongDataUrl}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors
              ${player.walkoutSongDataUrl
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
            `}
            title={player.walkoutSongDataUrl ? `Play ${player.walkoutSongName || 'walkout song'}` : 'No walkout song uploaded'}
          >
            {playingPlayerId === player.id ? <Square size={12} /> : <Play size={12} />}
            <Music2 size={12} />
          </button>
        </div>

        {/* Defensive Positions */}
        <div className="flex flex-wrap gap-1 ml-11 md:ml-0">
          {Array.from({ length: assignments.innings }, (_, i) => {
            const inningNum = i + 1;
            const pos = getPlayerPosition(inningNum);
            return (
              <div key={inningNum} className="flex flex-col items-center">
                <span className="text-[8px] text-slate-400 font-bold uppercase">Inn {inningNum}</span>
                <div className={`
                  px-2 py-0.5 rounded text-[10px] font-bold min-w-[32px] text-center
                  ${pos === 'Bench' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600'}
                `}>
                  {pos}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <button 
        {...attributes} 
        {...listeners}
        className="p-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </button>
    </div>
  );
};

export const BattingTab: React.FC<BattingTabProps> = ({ players, battingOrder, assignments, onReorder, onSaveAsGame }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingPlayerId, setPlayingPlayerId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = battingOrder.indexOf(active.id as string);
      const newIndex = battingOrder.indexOf(over.id as string);
      onReorder(arrayMove(battingOrder, oldIndex, newIndex));
    }
  };

  const playerMap = new Map(players.map(p => [p.id, p]));

  const stopCurrentAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
    setPlayingPlayerId(null);
  };

  const handlePlayWalkout = (player: Player) => {
    if (!player.walkoutSongDataUrl) return;

    if (playingPlayerId === player.id) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();

    const audio = new Audio(player.walkoutSongDataUrl);
    audioRef.current = audio;
    setPlayingPlayerId(player.id);

    const startAt = Math.max(0, player.walkoutStartSec || 0);
    audio.addEventListener('loadedmetadata', () => {
      const maxSafeStart = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.1) : startAt;
      audio.currentTime = Math.min(startAt, maxSafeStart);
      void audio.play().catch(() => setPlayingPlayerId(null));
    });
    audio.addEventListener('ended', () => setPlayingPlayerId(null));
    audio.addEventListener('pause', () => {
      if (audio.currentTime === 0 || audio.ended) setPlayingPlayerId(null);
    });
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Hash className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Batting Order</h2>
        </div>
        <button
          onClick={() => void onSaveAsGame()}
          className="ml-auto inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Save size={16} /> Save As Game
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={battingOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {battingOrder.map((id, index) => {
              const player = playerMap.get(id);
              if (!player) return null;
              return (
                <SortableItem 
                  key={id} 
                  id={id} 
                  player={player} 
                  index={index} 
                  assignments={assignments}
                  playingPlayerId={playingPlayerId}
                  onPlayWalkout={handlePlayWalkout}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {battingOrder.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400">Add players in the Roster tab to set the batting order.</p>
        </div>
      )}
    </div>
  );
};
