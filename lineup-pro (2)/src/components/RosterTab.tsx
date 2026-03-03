import React, { useState } from 'react';
import { Plus, Trash2, Users, FileText, Edit2, Check, X } from 'lucide-react';
import { Player } from '../types';

import { cn } from '../lib/utils';

interface RosterTabProps {
  players: Player[];
  onAdd: (name: string, number?: string) => void;
  onBulkAdd: (names: string) => void;
  onUpdate: (id: string, updates: Partial<Player>) => void;
  onDelete: (id: string) => void;
  onSaveAsMaster: () => void;
  onLoadMaster: () => void;
}

export const RosterTab: React.FC<RosterTabProps> = ({ 
  players, onAdd, onBulkAdd, onUpdate, onDelete, onSaveAsMaster, onLoadMaster 
}) => {
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [isBulk, setIsBulk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(newName.trim(), newNumber.trim() || undefined);
      setNewName('');
      setNewNumber('');
    }
  };

  const handleBulkAdd = () => {
    if (bulkNames.trim()) {
      onBulkAdd(bulkNames);
      setBulkNames('');
      setIsBulk(false);
    }
  };

  const startEdit = (player: Player) => {
    setEditingId(player.id);
    setEditName(player.name);
    setEditNumber(player.number || '');
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onUpdate(editingId, { name: editName.trim(), number: editNumber.trim() || undefined });
      setEditingId(null);
    }
  };

  const activeCount = players.filter(p => p.active !== false).length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex items-center gap-2">
          <Users className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Roster Management</h2>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-sm font-medium">
            {activeCount} / {players.length} Active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onSaveAsMaster}
            className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
          >
            Save as Default Roster
          </button>
          <button 
            onClick={onLoadMaster}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100 transition-colors"
          >
            Load Default Roster
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Add Players</h3>
          <button 
            onClick={() => setIsBulk(!isBulk)}
            className="text-sm text-indigo-600 font-medium hover:underline"
          >
            {isBulk ? "Single Add" : "Bulk Add"}
          </button>
        </div>

        {isBulk ? (
          <div className="space-y-4">
            <textarea
              value={bulkNames}
              onChange={(e) => setBulkNames(e.target.value)}
              placeholder="Enter one player per line (optional number first, e.g. 12 Mike)..."
              className="w-full h-32 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
            <button 
              onClick={handleBulkAdd}
              className="w-full bg-indigo-600 text-white py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Add Players
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="#"
              className="w-20 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Player Name"
              className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
            <button 
              onClick={handleAdd}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Add
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player) => (
          <div 
            key={player.id}
            className={cn(
              "bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group transition-all",
              player.active === false ? "opacity-60 border-slate-100 grayscale bg-slate-50" : "border-slate-100 hover:border-indigo-200"
            )}
          >
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
              <button 
                onClick={() => onUpdate(player.id, { active: player.active === false })}
                className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                  player.active === false ? "bg-slate-100 border-slate-200 text-slate-400" : "bg-emerald-500 border-emerald-600 text-white"
                )}
                title={player.active === false ? "Mark as Present" : "Mark as Absent"}
              >
                {player.active !== false && <Check size={12} strokeWidth={4} />}
              </button>
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: player.color }}
              />
              {editingId === player.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="w-14 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 text-sm font-semibold"
                    placeholder="#"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="flex-1 bg-slate-50 border-none focus:ring-0 p-0 text-slate-800 font-medium"
                  />
                </div>
              ) : (
                <span className={cn(
                  "font-medium truncate",
                  player.active === false ? "text-slate-400 line-through" : "text-slate-700"
                )}>
                  {player.number ? `#${player.number} ` : ''}{player.name}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {editingId === player.id ? (
                <>
                  <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <input 
                    type="color" 
                    value={player.color} 
                    onChange={(e) => onUpdate(player.id, { color: e.target.value })}
                    className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer"
                  />
                  <button onClick={() => startEdit(player)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => onDelete(player.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
