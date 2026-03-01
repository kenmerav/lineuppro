import React from 'react';
import { Settings as SettingsIcon, ShieldCheck, Layout, Info } from 'lucide-react';
import { Settings } from '../types';

interface SettingsTabProps {
  settings: Settings;
  onUpdate: (settings: Settings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onUpdate }) => {
  const handleChange = (key: keyof Settings, value: any) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-2">
        <SettingsIcon className="text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-800">Application Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Game Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-50 pb-4">
            <Layout size={18} className="text-indigo-500" />
            Game Configuration
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-700">Innings Count</p>
                <p className="text-xs text-slate-400">Number of innings to plan for (3-7)</p>
              </div>
              <div className="flex items-center gap-2">
                {[3, 4, 5, 6, 7].map(num => (
                  <button
                    key={num}
                    onClick={() => handleChange('inningsCount', num)}
                    className={`w-10 h-10 rounded-xl font-bold transition-all ${
                      settings.inningsCount === num 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rule Enforcement */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-50 pb-4">
            <ShieldCheck size={18} className="text-indigo-500" />
            Rule Enforcement
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-700">Allow Empty Outfield</p>
                <p className="text-xs text-slate-400">Don't flag as error if outfield slots are empty (for small rosters)</p>
              </div>
              <button 
                onClick={() => handleChange('allowEmptyOutfield', !settings.allowEmptyOutfield)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.allowEmptyOutfield ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.allowEmptyOutfield ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-700">Require Dugout</p>
                <p className="text-xs text-slate-400">Flag warning if no players are on bench when roster {'>'}= 10</p>
              </div>
              <button 
                onClick={() => handleChange('requireDugout', !settings.requireDugout)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.requireDugout ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.requireDugout ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-700">Strict Swap Behavior</p>
                <p className="text-xs text-slate-400">Automatically swap positions when assigning an already-placed player</p>
              </div>
              <button 
                onClick={() => handleChange('strictSwap', !settings.strictSwap)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.strictSwap ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.strictSwap ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="border-t border-slate-50 pt-4">
              <p className="font-bold text-slate-700 mb-2">Max Consecutive Infield Innings</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map(num => (
                  <button
                    key={num}
                    onClick={() => handleChange('maxConsecutiveInfield', num)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      settings.maxConsecutiveInfield === num 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-50 pt-4">
              <p className="font-bold text-slate-700 mb-2">Max Consecutive Outfield Innings</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map(num => (
                  <button
                    key={num}
                    onClick={() => handleChange('maxConsecutiveOutfield', num)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      settings.maxConsecutiveOutfield === num 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
              <div>
                <p className="font-bold text-slate-700">Allow Same Position Back-to-Back</p>
                <p className="text-xs text-slate-400">Don't flag warning if a player stays in the same position for multiple innings</p>
              </div>
              <button 
                onClick={() => handleChange('allowSamePositionBackToBack', !settings.allowSamePositionBackToBack)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.allowSamePositionBackToBack ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.allowSamePositionBackToBack ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-indigo-50 p-4 rounded-2xl flex gap-3">
          <Info className="text-indigo-600 flex-shrink-0" size={20} />
          <div className="text-sm text-indigo-800">
            <p className="font-bold mb-1">League Rules & Customization</p>
            <p>Adjust these settings to match your league's specific fair-play requirements. Violations will be highlighted in the Defensive Rotation tab.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
