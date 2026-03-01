/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { RosterTab } from './RosterTab';
import { BattingTab } from './BattingTab';
import { DefenseTab } from './DefenseTab';
import { AnalyticsTab } from './AnalyticsTab';
import { PostGameTab } from './PostGameTab';
import { GamesTab } from './GamesTab';
import { SettingsTab } from './SettingsTab';
import { useAppState } from '../hooks/useAppState';
import { Users, Hash, Shield, BarChart3, FolderOpen, Settings as SettingsIcon, Printer, Share2, ClipboardCheck, LayoutDashboard, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { POSITION_GROUPS } from '../constants';

type Tab = 'roster' | 'batting' | 'defense' | 'analytics' | 'postgame' | 'games' | 'settings';

export const TeamView: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('roster');
  const {
    players, battingOrder, assignments, settings, branding, savedGames, gameLog, loading,
    setBattingOrder, setAssignments, setSettings, setBranding, setSavedGames, setGameLog,
    addPlayer, bulkAddPlayers, updatePlayer, deletePlayer,
    saveGame, loadGame, generateDefense,
    saveAsMasterRoster, loadMasterRoster, startNewGame
  } = useAppState(teamId);

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) navigate('/login');
    };
    checkAuth();
  }, [navigate]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin text-indigo-600 mx-auto" size={48} />
        <p className="text-slate-500 font-medium">Loading your team...</p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'roster', label: 'Roster', icon: Users },
    { id: 'batting', label: 'Batting', icon: Hash },
    { id: 'defense', label: 'Defense', icon: Shield },
    { id: 'analytics', label: 'Fairness', icon: BarChart3 },
    { id: 'postgame', label: 'Results', icon: ClipboardCheck },
    { id: 'games', label: 'Games', icon: FolderOpen },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const text = `
Team: ${branding.teamName}
Batting Order:
${battingOrder.map((id, i) => `${i + 1}. ${players.find(p => p.id === id)?.name}`).join('\n')}

Defensive Rotation:
${Array.from({ length: assignments.innings }, (_, i) => {
  const inningNum = i + 1;
  const inning = assignments.byInning[inningNum];
  return `Inning ${inningNum}: ${Object.entries(inning || {}).filter(([k]) => k !== 'dugout').map(([pos, pid]) => `${pos}: ${players.find(p => p.id === pid)?.name}`).join(', ')}`;
}).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    alert('Lineup copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header branding={branding} onUpdate={setBranding} />

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 overflow-x-auto no-scrollbar print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-4 text-slate-400 hover:text-indigo-600 border-r border-slate-100 mr-2"
              title="Back to Dashboard"
            >
              <LayoutDashboard size={20} />
            </button>
            <div className="flex">
              {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap",
                  activeTab === tab.id ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab" 
                    className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pr-4">
            <button 
              onClick={handleShare}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors"
              title="Copy to Clipboard"
            >
              <Share2 size={20} />
            </button>
            <button 
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors"
              title="Print View"
            >
              <Printer size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'roster' && (
              <RosterTab 
                players={players} 
                onAdd={addPlayer} 
                onBulkAdd={bulkAddPlayers} 
                onUpdate={updatePlayer} 
                onDelete={deletePlayer} 
                onSaveAsMaster={saveAsMasterRoster}
                onLoadMaster={loadMasterRoster}
              />
            )}
            {activeTab === 'batting' && (
              <BattingTab 
                players={players} 
                battingOrder={battingOrder} 
                assignments={assignments}
                onReorder={setBattingOrder} 
              />
            )}
            {activeTab === 'defense' && (
              <DefenseTab 
                players={players} 
                assignments={assignments} 
                settings={settings} 
                onUpdate={setAssignments} 
                onGenerate={generateDefense}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsTab 
                players={players} 
                assignments={assignments} 
                settings={settings}
                gameLog={gameLog}
                savedGames={savedGames}
              />
            )}
            {activeTab === 'postgame' && (
              <PostGameTab 
                players={players}
                assignments={assignments}
                gameLog={gameLog}
                onSaveLog={setGameLog}
              />
            )}
            {activeTab === 'games' && (
              <GamesTab 
                savedGames={savedGames} 
                onSave={saveGame} 
                onLoad={loadGame} 
                onDelete={(id) => setSavedGames(prev => prev.filter(g => g.id !== id))} 
                onImport={(game) => setSavedGames(prev => [...prev, game])}
                onNewGame={startNewGame}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab 
                settings={settings} 
                onUpdate={setSettings} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Print View Overlay (Hidden normally) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[100] p-8 overflow-y-auto">
        <div className="flex flex-col items-center mb-8">
          {branding.logoDataUrl && (
            <img src={branding.logoDataUrl} alt="Logo" className="h-24 mb-4 object-contain" referrerPolicy="no-referrer" />
          )}
          <h1 className="text-4xl font-black text-slate-900">{branding.teamName}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest mt-2">Game Lineup & Rotation</p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-1 border-r border-slate-200 pr-8">
            <h2 className="text-xl font-black mb-4 border-b-2 border-slate-900 pb-2 uppercase">Batting Order</h2>
            <div className="space-y-2">
              {(battingOrder || []).map((id, i) => (
                <div key={id} className="flex items-center gap-3 font-bold text-lg">
                  <span className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-full text-sm">{i + 1}</span>
                  <span className="text-slate-800">{(players || []).find(p => p.id === id)?.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <h2 className="text-xl font-black mb-4 border-b-2 border-slate-900 pb-2 uppercase">Defensive Rotation</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs font-bold text-slate-400 uppercase">Pos</th>
                  {Array.from({ length: assignments.innings }, (_, i) => (
                    <th key={i} className="p-2 text-center text-sm font-bold bg-slate-100 border border-slate-200">Inn {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...POSITION_GROUPS.INFIELD, ...POSITION_GROUPS.OUTFIELD, 'Bench'].map(pos => (
                  <tr key={pos}>
                    <td className="p-2 font-bold text-slate-600 text-sm border border-slate-200">{pos}</td>
                    {Array.from({ length: assignments.innings }, (_, i) => {
                      const inningNum = i + 1;
                      const inning = assignments.byInning[inningNum];
                      let name = '-';
                      if (pos === 'Bench') {
                        name = inning?.dugout.map(pid => (players || []).find(p => p.id === pid)?.name).join(', ') || '-';
                      } else {
                        const pid = inning?.[pos];
                        name = (players || []).find(p => p.id === pid)?.name || '-';
                      }
                      return (
                        <td key={i} className="p-2 text-center text-sm font-medium border border-slate-200">{name}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 print:hidden">
        <p>© 2026 Lineup Pro • Built for Fairness & Fun</p>
      </footer>
    </div>
  );
}
