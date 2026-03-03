import React from 'react';
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
import { GripVertical, Hash, Save } from 'lucide-react';
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
}

const SortableItem: React.FC<SortableItemProps> = ({ id, player, index, assignments }) => {
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
