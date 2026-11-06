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
import { Player, DefenseAssignments, Settings } from '../types';
import { BATTING_ONLY_POSITIONS, getAllPositions } from '../constants';
import { getBattingEligiblePlayerIds, getBattingLineupIds } from '../utils';

interface BattingTabProps {
  players: Player[];
  battingOrder: string[];
  assignments: DefenseAssignments;
  settings: Settings;
  onReorder: (newOrder: string[]) => void;
  onSaveAsGame: () => Promise<void>;
}

interface SortableItemProps {
  id: string;
  player: Player;
  index: number;
  isHitter: boolean;
  hasPosition: boolean;
  assignments: DefenseAssignments;
  settings: Settings;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, player, index, isHitter, hasPosition, assignments, settings }) => {
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
    
    for (const pos of [...getAllPositions(settings), ...BATTING_ONLY_POSITIONS]) {
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
            {isHitter ? index + 1 : '—'}
          </div>
          <div 
            className="w-1.5 h-8 rounded-full" 
            style={{ backgroundColor: player.color }}
          />
          <span className="font-semibold text-slate-800 min-w-[120px]">
            {player.number ? `#${player.number} ` : ''}{player.name}
          </span>
          {player.grade && (
            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
              {player.grade}th
            </span>
          )}
          {settings.sport === 'baseball' && !hasPosition && (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              No position
            </span>
          )}
        </div>

        {/* Defensive Positions */}
        <div className="flex flex-wrap gap-1 ml-11 md:ml-0">
          {(settings.sport === 'baseball' ? [1] : Array.from({ length: assignments.innings }, (_, i) => i + 1)).map((inningNum) => {
            const pos = getPlayerPosition(inningNum);
            return (
              <div key={inningNum} className="flex flex-col items-center">
                <span className="text-[8px] text-slate-400 font-bold uppercase">{settings.sport === 'baseball' ? 'Defense' : `Inn ${inningNum}`}</span>
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

export const BattingTab: React.FC<BattingTabProps> = ({ players, battingOrder, assignments, settings, onReorder, onSaveAsGame }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const eligiblePlayerIds = getBattingEligiblePlayerIds(assignments, settings);
  const hittingOrder = getBattingLineupIds(battingOrder, settings, assignments);
  const hittingIds = new Set(hittingOrder);
  const eligibleNotBatting = battingOrder.filter((id) => eligiblePlayerIds.has(id) && !hittingIds.has(id));
  const noPosition = battingOrder.filter((id) => !eligiblePlayerIds.has(id));
  const displayOrder = settings.sport === 'baseball'
    ? [...hittingOrder, ...eligibleNotBatting, ...noPosition]
    : battingOrder;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = displayOrder.indexOf(active.id as string);
      const newIndex = displayOrder.indexOf(over.id as string);
      onReorder(arrayMove(displayOrder, oldIndex, newIndex));
    }
  };

  const playerMap = new Map(players.map(p => [p.id, p]));
  const battingCount = settings.sport === 'baseball'
    ? Math.max(1, Math.floor(settings.battingCount || 9))
    : battingOrder.length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Hash className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Batting Order</h2>
          {settings.sport === 'baseball' && (
            <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
              {hittingOrder.length} / {battingCount} hitters
            </span>
          )}
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
          items={displayOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {displayOrder.map((id, index) => {
              const player = playerMap.get(id);
              if (!player) return null;
              const isHitter = hittingIds.has(id);
              const hasPosition = eligiblePlayerIds.has(id);
              const firstNotBattingIndex = hittingOrder.length;
              const firstNoPositionIndex = hittingOrder.length + eligibleNotBatting.length;
              return (
                <React.Fragment key={id}>
                  {settings.sport === 'baseball' && eligibleNotBatting.length > 0 && index === firstNotBattingIndex && (
                    <div className="flex items-center gap-3 py-2" aria-label="Not batting">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-bold uppercase text-slate-400">Not batting</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}
                  {settings.sport === 'baseball' && noPosition.length > 0 && index === firstNoPositionIndex && (
                    <div className="flex items-center gap-3 py-2" aria-label="No position">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-bold uppercase text-amber-500">No position</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}
                  <SortableItem
                    id={id}
                    player={player}
                    index={settings.sport === 'baseball' ? hittingOrder.indexOf(id) : index}
                    isHitter={settings.sport !== 'baseball' || isHitter}
                    hasPosition={settings.sport !== 'baseball' || hasPosition}
                    assignments={assignments}
                    settings={settings}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {displayOrder.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400">Add players in the Roster tab to set the batting order.</p>
        </div>
      )}
    </div>
  );
};
