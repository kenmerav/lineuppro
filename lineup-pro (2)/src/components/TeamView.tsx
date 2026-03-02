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
import { DefensiveFieldDiagram } from './DefensiveFieldDiagram';
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
  const [selectedInning, setSelectedInning] = useState(1);
  const {
    players, battingOrder, assignments, settings, branding, savedGames, gameLog, loading, activeGameId,
    setBattingOrder, setAssignments, setSettings, setBranding, setGameLog,
    addPlayer, bulkAddPlayers, updatePlayer, deletePlayer,
    saveGame, updateGame, loadGame, deleteGame, importGame, generateDefense,
    saveAsMasterRoster, loadMasterRoster, startNewGame
  } = useAppState(teamId);

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) navigate('/login');
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (selectedInning > assignments.innings) {
      setSelectedInning(assignments.innings || 1);
    }
  }, [assignments.innings, selectedInning]);

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

  const allFieldPositions = [...POSITION_GROUPS.INFIELD, ...POSITION_GROUPS.OUTFIELD];
  const getPlayerPositionForInning = (playerId: string, inningNum: number) => {
    const inning = assignments.byInning[inningNum];
    if (!inning) return '-';
    if ((inning.dugout || []).includes(playerId)) return 'BENCH';
    const pos = allFieldPositions.find((p) => inning[p] === playerId);
    return pos || '-';
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
                selectedInning={selectedInning}
                onSelectedInningChange={setSelectedInning}
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
                onUpdate={updateGame}
                onLoad={loadGame} 
                onDelete={deleteGame}
                onImport={importGame}
                onNewGame={startNewGame}
                activeGameId={activeGameId}
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
      <div className="hidden print:block fixed inset-0 bg-white z-[100] p-0 overflow-hidden">
        <div className="h-full w-full flex flex-col gap-2 px-3 py-2">
        <div className="flex flex-col items-center mb-1">
          {branding.logoDataUrl && (
            <img src={branding.logoDataUrl} alt="Logo" className="h-14 mb-1 object-contain" referrerPolicy="no-referrer" />
          )}
          <h1 className="text-2xl font-black text-slate-900 leading-tight">{branding.teamName}</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Game Lineup & Rotation</p>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-3 items-start min-h-0 flex-1">
          <div className="min-w-0">
            <h2 className="text-sm font-black mb-2 border-b-2 border-slate-900 pb-1 uppercase">Batting Order + Positions</h2>
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="w-10 p-1 text-center text-[10px] font-black text-slate-500 border border-slate-300 bg-slate-100">#</th>
                  <th className="w-44 p-1 text-left text-[10px] font-black text-slate-500 border border-slate-300 bg-slate-100">Player</th>
                  {Array.from({ length: assignments.innings }, (_, i) => (
                    <th key={i} className="p-1 text-center text-[10px] font-black text-slate-500 border border-slate-300 bg-slate-100">
                      In {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(battingOrder || []).map((id, i) => {
                  const playerName = (players || []).find(p => p.id === id)?.name || '-';
                  return (
                    <tr key={id}>
                      <td className="p-1 text-center text-xs font-bold text-slate-800 border border-slate-300">{i + 1}</td>
                      <td className="p-1 text-xs font-semibold text-slate-800 border border-slate-300 truncate">{playerName}</td>
                      {Array.from({ length: assignments.innings }, (_, inningIndex) => {
                        const inningNum = inningIndex + 1;
                        const pos = getPlayerPositionForInning(id, inningNum);
                        return (
                          <td
                            key={inningNum}
                            className="p-1 text-center text-[10px] font-bold border border-slate-300 text-slate-700"
                          >
                            {pos}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <DefensiveFieldDiagram
              assignments={assignments}
              players={players}
              inning={selectedInning}
              title={`Field - Inning ${selectedInning}`}
              className="print:border-slate-300 w-full max-w-none mx-auto"
              showPlayerNames={false}
              showBenchSummary={false}
            />
            <div className="text-[10px] text-slate-500 font-semibold text-center">
              Position codes are listed by inning in the table.
            </div>
          </div>
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
