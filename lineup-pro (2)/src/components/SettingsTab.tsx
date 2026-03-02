import React, { useState } from 'react';
import { Settings as SettingsIcon, ShieldCheck, Layout, Info, Plus, X } from 'lucide-react';
import { Settings } from '../types';

interface SettingsTabProps {
  settings: Settings;
  onUpdate: (settings: Settings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onUpdate }) => {
  const [newRule, setNewRule] = useState('');

  const handleChange = (key: keyof Settings, value: any) => {
    onUpdate({ ...settings, [key]: value });
  };

  const addCustomRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    const current = Array.isArray(settings.customRules) ? settings.customRules : [];
    if (current.includes(trimmed)) {
      setNewRule('');
      return;
    }
    handleChange('customRules', [...current, trimmed]);
    setNewRule('');
  };

  const removeCustomRule = (rule: string) => {
    const current = Array.isArray(settings.customRules) ? settings.customRules : [];
    handleChange('customRules', current.filter(r => r !== rule));
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

            <div className="border-t border-slate-50 pt-4">
              <p className="font-bold text-slate-700 mb-2">Max Consecutive Bench Innings</p>
              <p className="text-xs text-slate-400 mb-3">Prevents the same player from sitting too many innings in a row.</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => handleChange('maxConsecutiveBench', num)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      settings.maxConsecutiveBench === num 
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

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
              <div>
                <p className="font-bold text-slate-700">Prevent Duplicate Positions In One Game</p>
                <p className="text-xs text-slate-400">Treat repeated use of the same exact position for a player as a hard violation.</p>
              </div>
              <button 
                onClick={() => handleChange('preventDuplicatePositionInGame', !settings.preventDuplicatePositionInGame)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.preventDuplicatePositionInGame ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.preventDuplicatePositionInGame ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
              <div>
                <p className="font-bold text-slate-700">Require Infield By Inning 3 (If Possible)</p>
                <p className="text-xs text-slate-400">Forces each player to get at least one infield inning in the first 3 when math allows.</p>
              </div>
              <button 
                onClick={() => handleChange('requireEarlyInfieldByInning3', !settings.requireEarlyInfieldByInning3)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.requireEarlyInfieldByInning3 ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.requireEarlyInfieldByInning3 ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Additional Rules List */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-50 pb-4">
            <ShieldCheck size={18} className="text-indigo-500" />
            Additional Rules List
          </div>

          <p className="text-xs text-slate-500">
            Add plain-language rules (example: "No same position twice", "Max bench 1", "Infield by inning 3").
            Supported patterns are enforced by auto-generate and validation.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomRule();
                }
              }}
              placeholder="Type a rule and press Enter"
              className="flex-1 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              onClick={addCustomRule}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="space-y-2">
            {(settings.customRules || []).length === 0 && (
              <p className="text-sm text-slate-400">No additional rules yet.</p>
            )}
            {(settings.customRules || []).map((rule) => (
              <div key={rule} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-700">{rule}</span>
                <button
                  onClick={() => removeCustomRule(rule)}
                  className="text-slate-400 hover:text-red-600"
                  title="Remove rule"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
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
