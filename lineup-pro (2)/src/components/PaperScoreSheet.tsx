import React from 'react';
import type {
  DefenseAssignments,
  GameMeta,
  Player,
  Settings,
  TeamBranding,
} from '../types';
import { getBattingLineupIds } from '../utils';

interface PaperScoreSheetProps {
  players: Player[];
  battingOrder: string[];
  assignments: DefenseAssignments;
  settings: Settings;
  branding: TeamBranding;
  gameMeta?: GameMeta;
  ourSide?: 'home' | 'away';
}

const PLATE_APPEARANCES = 5;
const PITCH_SLOTS = 8;
const SCORE_INNINGS = 7;

const BlankLines = ({ count }: { count: number }) => (
  <div className="space-y-2">
    {Array.from({ length: count }, (_, index) => <div key={index} className="h-4 border-b border-slate-500" />)}
  </div>
);

const LineScore = ({ teamName, opponentName, ourSide }: { teamName: string; opponentName: string; ourSide: 'home' | 'away' }) => {
  const away = ourSide === 'away' ? teamName : opponentName;
  const home = ourSide === 'home' ? teamName : opponentName;
  return (
    <table className="w-full table-fixed border-collapse text-[9px]">
      <thead>
        <tr>
          <th className="w-36 border border-slate-900 bg-slate-100 p-1 text-left">LINE SCORE</th>
          {Array.from({ length: SCORE_INNINGS }, (_, index) => <th key={index} className="border border-slate-900 p-1">{index + 1}</th>)}
          <th className="border border-slate-900 bg-slate-100 p-1">R</th>
          <th className="border border-slate-900 bg-slate-100 p-1">H</th>
          <th className="border border-slate-900 bg-slate-100 p-1">E</th>
        </tr>
      </thead>
      <tbody>
        {[['AWAY', away], ['HOME', home]].map(([side, name]) => (
          <tr key={side}>
            <th className="h-7 border border-slate-900 px-2 text-left font-bold"><span className="mr-2 text-[7px] text-slate-500">{side}</span>{name}</th>
            {Array.from({ length: SCORE_INNINGS + 3 }, (_, index) => <td key={index} className="border border-slate-900" />)}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ScoreGrid = ({
  title,
  rows,
  opponent = false,
}: {
  title: string;
  rows: Array<{ id: string; number?: string; name?: string; position?: string }>;
  opponent?: boolean;
}) => (
  <div>
    <div className="mb-1 flex items-end justify-between">
      <h2 className="text-sm font-black uppercase">{title}</h2>
      <p className="text-[8px] font-bold text-slate-600">Mark each pitch B or S, then write the inning and result.</p>
    </div>
    <table className="w-full table-fixed border-collapse text-[8px]">
      <thead>
        <tr className="bg-slate-100">
          <th className="w-7 border border-slate-900 p-1">#</th>
          <th className="w-10 border border-slate-900 p-1">JERSEY</th>
          <th className="w-36 border border-slate-900 p-1 text-left">PLAYER</th>
          <th className="w-10 border border-slate-900 p-1">POS</th>
          {Array.from({ length: PLATE_APPEARANCES }, (_, index) => <th key={index} className="border border-slate-900 p-1">PA {index + 1}</th>)}
          <th className="w-7 border border-slate-900 p-1">R</th>
          <th className="w-7 border border-slate-900 p-1">H</th>
          <th className="w-8 border border-slate-900 p-1">RBI</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id}>
            <td className="h-10 border border-slate-900 text-center font-bold">{index + 1}</td>
            <td className="border border-slate-900 text-center text-[10px] font-bold">{row.number || ''}</td>
            <td className="border border-slate-900 px-2 text-[10px] font-semibold">{opponent ? '' : row.name}</td>
            <td className="border border-slate-900 text-center text-[10px] font-bold">{opponent ? '' : row.position}</td>
            {Array.from({ length: PLATE_APPEARANCES }, (_, paIndex) => (
              <td key={paIndex} className="border border-slate-900 p-0.5 align-top">
                <div className="mb-0.5 flex justify-between text-[5px] font-black text-slate-500">
                  <span>INN ____</span><span>RESULT ______</span>
                </div>
                {(['B', 'S'] as const).map((call) => (
                  <div key={call} className="mb-px grid items-center gap-px" style={{ gridTemplateColumns: `8px repeat(${PITCH_SLOTS}, minmax(0, 1fr))` }}>
                    <span className="text-[6px] font-black">{call}</span>
                    {Array.from({ length: PITCH_SLOTS }, (_, pitchIndex) => (
                      <span key={pitchIndex} title={`Pitch ${pitchIndex + 1} ${call === 'B' ? 'ball' : 'strike'}`} className="h-2 border border-slate-500" />
                    ))}
                  </div>
                ))}
              </td>
            ))}
            <td className="border border-slate-900" />
            <td className="border border-slate-900" />
            <td className="border border-slate-900" />
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SheetHeader = ({
  pageTitle,
  branding,
  meta,
  opponentName,
}: {
  pageTitle: string;
  branding: TeamBranding;
  meta?: GameMeta;
  opponentName: string;
}) => (
  <header className="mb-2 flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-2">
    <div className="flex min-w-0 items-center gap-3">
      {branding.logoDataUrl && <img src={branding.logoDataUrl} alt="" className="h-11 w-11 object-contain" />}
      <div>
        <h1 className="text-xl font-black leading-tight">{branding.teamName}</h1>
        <p className="text-[10px] font-black uppercase text-slate-600">{pageTitle}</p>
      </div>
    </div>
    <div className="grid min-w-[5.3in] grid-cols-4 gap-x-3 gap-y-1 text-[8px] font-bold uppercase">
      <div className="col-span-2 border-b border-slate-900 pb-1"><span className="text-slate-500">Game:</span> {meta?.name || ''}</div>
      <div className="border-b border-slate-900 pb-1"><span className="text-slate-500">Date:</span> {meta?.date || ''}</div>
      <div className="border-b border-slate-900 pb-1"><span className="text-slate-500">Start:</span></div>
      <div className="col-span-2 border-b border-slate-900 pb-1"><span className="text-slate-500">Opponent:</span> {opponentName}</div>
      <div className="border-b border-slate-900 pb-1"><span className="text-slate-500">Location:</span> {meta?.location || ''}</div>
      <div className="border-b border-slate-900 pb-1"><span className="text-slate-500">Scorekeeper:</span></div>
    </div>
  </header>
);

const SheetFooter = ({ opponent = false }: { opponent?: boolean }) => (
  <div className="mt-2 grid grid-cols-[1.15fr_1fr_1fr] gap-3 text-[8px]">
    <section>
      <h3 className="mb-1 font-black uppercase">{opponent ? 'Opponent pitching' : 'Our pitching'}</h3>
      <table className="w-full table-fixed border-collapse">
        <thead><tr className="bg-slate-100"><th className="border border-slate-900">PITCHER # / NAME</th><th className="w-9 border border-slate-900">IP</th><th className="w-10 border border-slate-900">PITCH</th><th className="w-7 border border-slate-900">K</th><th className="w-7 border border-slate-900">BB</th><th className="w-7 border border-slate-900">H</th><th className="w-7 border border-slate-900">R</th></tr></thead>
        <tbody>{Array.from({ length: 4 }, (_, index) => <tr key={index}>{Array.from({ length: 7 }, (_, cell) => <td key={cell} className="h-5 border border-slate-900" />)}</tr>)}</tbody>
      </table>
    </section>
    <section>
      <h3 className="mb-1 font-black uppercase">Substitutions</h3>
      <table className="w-full table-fixed border-collapse">
        <thead><tr className="bg-slate-100"><th className="w-9 border border-slate-900">INN</th><th className="border border-slate-900">PLAYER OUT</th><th className="border border-slate-900">PLAYER IN</th><th className="w-9 border border-slate-900">POS</th></tr></thead>
        <tbody>{Array.from({ length: 4 }, (_, index) => <tr key={index}>{Array.from({ length: 4 }, (_, cell) => <td key={cell} className="h-5 border border-slate-900" />)}</tr>)}</tbody>
      </table>
    </section>
    <section>
      <h3 className="mb-1 font-black uppercase">Notes / unusual plays</h3>
      <BlankLines count={opponent ? 3 : 4} />
    </section>
    {!opponent && <p className="col-span-3 border-t border-slate-400 pt-1 text-[7px] font-bold text-slate-600">
      RESULT KEY: K strikeout · BB walk · HBP hit by pitch · 1B single · 2B double · 3B triple · HR home run · E1-E9 error · FC fielder's choice · SAC sacrifice · OUT or fielding play (example 6-3). Circle the result when a run scores and write RBI total at right.
    </p>}
  </div>
);

export const PaperScoreSheet: React.FC<PaperScoreSheetProps> = ({
  players,
  battingOrder,
  assignments,
  settings,
  branding,
  gameMeta,
  ourSide = 'home',
}) => {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const battingIds = getBattingLineupIds(battingOrder, settings, assignments);
  const firstInning = assignments.byInning[1] || { dugout: [] };
  const positionFor = (playerId: string) => Object.entries(firstInning)
    .find(([position, assigned]) => position !== 'dugout' && assigned === playerId)?.[0] || '';
  const ourRows = [
    ...battingIds.map((id) => {
      const player = playerMap.get(id);
      return { id, number: player?.number, name: player?.name, position: positionFor(id) };
    }),
    ...Array.from({ length: Math.max(1, 10 - battingIds.length) }, (_, index) => ({ id: `our-blank-${index}` })),
  ];
  const opponentRows = Array.from({ length: 10 }, (_, index) => ({ id: `opponent-${index}` }));
  const opponentName = gameMeta?.opponent?.trim() || '________________________';

  return (
    <div className="paper-score-print hidden bg-white text-slate-950 print:block">
      <article className="paper-score-page min-h-[7.35in] w-full bg-white p-[0.18in]">
        <SheetHeader pageTitle="Paper Score Sheet · Our Batting" branding={branding} meta={gameMeta} opponentName={opponentName} />
        <LineScore teamName={branding.teamName} opponentName={opponentName} ourSide={ourSide} />
        <div className="mt-2"><ScoreGrid title={`${branding.teamName} batting`} rows={ourRows} /></div>
        <SheetFooter />
      </article>

      <article className="paper-score-page min-h-[7.35in] w-full bg-white p-[0.18in]">
        <SheetHeader pageTitle="Paper Score Sheet · Opponent Batting" branding={branding} meta={gameMeta} opponentName={opponentName} />
        <LineScore teamName={branding.teamName} opponentName={opponentName} ourSide={ourSide} />
        <div className="mt-2"><ScoreGrid title={`${opponentName} batting`} rows={opponentRows} opponent /></div>
        <SheetFooter opponent />
      </article>
    </div>
  );
};
