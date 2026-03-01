import React from 'react';
import { Camera, Upload, Trash2 } from 'lucide-react';
import { TeamBranding } from '../types';

interface HeaderProps {
  branding: TeamBranding;
  onUpdate: (updates: Partial<TeamBranding>) => void;
}

export const Header: React.FC<HeaderProps> = ({ branding, onUpdate }) => {
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate({ logoDataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <header 
      className="w-full py-6 px-4 flex flex-col items-center justify-center gap-4 transition-colors duration-300"
      style={{ backgroundColor: branding.bannerColor || '#f8fafc' }}
    >
      <div className="relative group">
        {branding.logoDataUrl ? (
          <div className="relative">
            <img 
              src={branding.logoDataUrl} 
              alt="Team Logo" 
              className="h-24 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => onUpdate({ logoDataUrl: undefined })}
              className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
            <Upload className="text-slate-400" />
            <span className="text-xs text-slate-400 mt-1">Logo</span>
            <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
          </label>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <input
          type="text"
          value={branding.teamName}
          onChange={(e) => onUpdate({ teamName: e.target.value })}
          className="text-3xl font-bold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-slate-500 focus:outline-none text-center px-2"
          placeholder="Enter Team Name"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Banner Color</label>
          <input
            type="color"
            value={branding.bannerColor || '#f8fafc'}
            onChange={(e) => onUpdate({ bannerColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border-none p-0"
          />
        </div>
      </div>
    </header>
  );
};
