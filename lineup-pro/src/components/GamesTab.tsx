import React, { useState } from 'react';
import { Save, FolderOpen, Download, Upload, Trash2, Copy, Search, Calendar, MapPin, FileText } from 'lucide-react';
import { SavedGame, GameMeta } from '../types';
import { format } from 'date-fns';

interface GamesTabProps {
  savedGames: SavedGame[];
  onSave: (meta: GameMeta) => void;
  onLoad: (game: SavedGame) => void;
  onDelete: (id: string) => void;
  onImport: (game: SavedGame) => void;
  onNewGame: (keepRoster: boolean) => void;
}

export const GamesTab: React.FC<GamesTabProps> = ({ 
  savedGames, onSave, onLoad, onDelete, onImport, onNewGame 
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isNewGameModal, setIsNewGameModal] = useState(false);
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<GameMeta>({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    opponent: '',
    location: '',
    notes: ''
  });

  const handleSave = () => {
    if (meta.name.trim()) {
      onSave(meta);
      setIsSaving(false);
      setMeta({
        name: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        opponent: '',
        location: '',
        notes: ''
      });
    }
  };

  const handleNewGame = (keepRoster: boolean) => {
    onNewGame(keepRoster);
    setIsNewGameModal(false);
  };

  const handleExport = (game: SavedGame) => {
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.meta.name.replace(/\s+/g, '_')}_${game.meta.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const game = JSON.parse(event.target?.result as string);
          onImport(game);
        } catch (err) {
          alert('Invalid game file');
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredGames = savedGames.filter(g => 
    g.meta.name.toLowerCase().includes(search.toLowerCase()) ||
    g.meta.opponent?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime());

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Game Library</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsNewGameModal(true)}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold hover:bg-slate-900 transition-colors"
          >
            <FileText size={18} /> New Game
          </button>
          <button 
            onClick={() => setIsSaving(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Save size={18} /> Save Current Game
          </button>
          <label className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-semibold hover:bg-slate-200 transition-colors cursor-pointer">
            <Upload size={18} /> Import
            <input type="file" className="hidden" onChange={handleImport} accept=".json" />
          </label>
        </div>
      </div>

      {isNewGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-800">Start New Game?</h3>
              <p className="text-slate-500 text-sm mt-2">This will clear all current defensive assignments.</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => handleNewGame(true)}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Keep Current Roster
              </button>
              <button 
                onClick={() => handleNewGame(false)}
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Clear Everything
              </button>
              <button 
                onClick={() => setIsNewGameModal(false)}
                className="w-full text-slate-400 py-2 text-sm font-medium hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-md space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-slate-800">Save Game Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Game Name *</label>
              <input 
                type="text" 
                value={meta.name} 
                onChange={e => setMeta({...meta, name: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Season Opener"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Date</label>
              <input 
                type="date" 
                value={meta.date} 
                onChange={e => setMeta({...meta, date: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Opponent</label>
              <input 
                type="text" 
                value={meta.opponent} 
                onChange={e => setMeta({...meta, opponent: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">Location</label>
              <input 
                type="text" 
                value={meta.location} 
                onChange={e => setMeta({...meta, location: e.target.value})}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Notes</label>
            <textarea 
              value={meta.notes} 
              onChange={e => setMeta({...meta, notes: e.target.value})}
              className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsSaving(false)} className="px-4 py-2 text-slate-500 font-semibold hover:bg-slate-50 rounded-xl">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Save Game</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search games by name or opponent..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGames.map(game => (
          <div key={game.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{game.meta.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <Calendar size={12} /> {game.meta.date}
                  </span>
                  {game.meta.opponent && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                      vs {game.meta.opponent}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleExport(game)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Export JSON">
                  <Download size={18} />
                </button>
                <button onClick={() => onDelete(game.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {game.meta.location && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <MapPin size={14} /> {game.meta.location}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex -space-x-2">
                {game.players.slice(0, 5).map(p => (
                  <div 
                    key={p.id} 
                    className="w-6 h-6 rounded-full border-2 border-white" 
                    style={{ backgroundColor: p.color }}
                    title={p.name}
                  />
                ))}
                {game.players.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                    +{game.players.length - 5}
                  </div>
                )}
              </div>
              <button 
                onClick={() => onLoad(game)}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors"
              >
                Load Game
              </button>
            </div>
          </div>
        ))}

        {filteredGames.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400">No saved games found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
