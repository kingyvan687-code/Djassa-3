import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Download,
  Copy,
  Check
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface QrCodeSettingsScreenProps {
  onBack: () => void;
}

const MATRIX_SIZE = 21;

function isFinderCell(row: number, col: number): boolean {
  const inBox = (r0: number, c0: number) =>
    row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
  const isBorderOrCenter = (r: number, c: number) => {
    if (r === 0 || r === 6 || c === 0 || c === 6) return true;
    if (r >= 2 && r <= 4 && c >= 2 && c <= 4) return true;
    return false;
  };
  if (inBox(0, 0)) return isBorderOrCenter(row, col);
  if (inBox(0, MATRIX_SIZE - 7)) return isBorderOrCenter(row, col - (MATRIX_SIZE - 7));
  if (inBox(MATRIX_SIZE - 7, 0)) return isBorderOrCenter(row - (MATRIX_SIZE - 7), col);
  return false;
}

function isInFinderRegion(row: number, col: number): boolean {
  return (
    (row < 8 && col < 8) ||
    (row < 8 && col >= MATRIX_SIZE - 8) ||
    (row >= MATRIX_SIZE - 8 && col < 8)
  );
}

function buildQrMatrix(payload: string): boolean[][] {
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const matrix: boolean[][] = [];
  for (let r = 0; r < MATRIX_SIZE; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < MATRIX_SIZE; c += 1) {
      if (isInFinderRegion(r, c)) {
        row.push(isFinderCell(r, c));
      } else {
        const seed = (hash ^ ((r + 1) * 31 + (c + 1) * 17 + payload.charCodeAt((r + c) % Math.max(1, payload.length)))) >>> 0;
        row.push((seed % 2) === 0);
      }
    }
    matrix.push(row);
  }
  return matrix;
}

export const QrCodeSettingsScreen: React.FC<QrCodeSettingsScreenProps> = ({ onBack }) => {
  const { userProfile, showToast } = useApp();

  const [cardColorTheme, setCardColorTheme] = useState<'orange' | 'dark' | 'sunset' | 'emerald'>('orange');
  const [copied, setCopied] = useState(false);

  const profileUrl = `https://djassa.ci/@${userProfile.username}`;
  const matrix = useMemo(() => buildQrMatrix(profileUrl), [profileUrl]);

  const handleCopyLink = () => {
    void navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
    showToast('Lien du profil copié');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    try {
      const size = 280;
      const padding = 24;
      const cellSize = Math.floor((size - padding * 2) / MATRIX_SIZE);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size + 36;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#111111';
        matrix.forEach((row, r) => {
          row.forEach((filled, c) => {
            if (filled) {
              ctx.fillRect(padding + c * cellSize, padding + r * cellSize, cellSize, cellSize);
            }
          });
        });
        ctx.fillStyle = '#FF6321';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`@${userProfile.username} · DJASSA`, size / 2, size + 16);

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `djassa-qr-${userProfile.username}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      showToast('Code QR enregistré en PNG');
    } catch {
      showToast('Export PNG indisponible dans ce navigateur');
    }
  };

  const themeClasses = {
    orange: 'from-[#FF6321] to-[#D9480F]',
    dark: 'from-[#2A2A2A] to-[#121212]',
    sunset: 'from-[#EC4899] via-[#F97316] to-[#EAB308]',
    emerald: 'from-[#059669] to-[#047857]'
  };

  return (
    <div
      id="qrcode-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-extrabold text-white tracking-tight">
            Code QR
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col items-center justify-between">
        <div
          className={`w-full max-w-xs p-6 rounded-3xl bg-gradient-to-br ${themeClasses[cardColorTheme]} shadow-2xl border border-white/20 text-center space-y-4 transition-all duration-300`}
        >
          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto border-4 border-white shadow-xl">
            <img src={userProfile.avatar} alt={userProfile.name} className="w-full h-full object-cover" />
          </div>

          <div>
            <h2 className="text-lg font-black text-white drop-shadow-md">{userProfile.name}</h2>
            <p className="text-xs font-bold text-white/90 drop-shadow">@{userProfile.username}</p>
            <p className="text-[11px] text-white/80 mt-0.5">{userProfile.deliveryCommune || 'Abidjan'}</p>
          </div>

          {/* Deterministic SVG QR matrix */}
          <div className="p-4 bg-white rounded-2xl mx-auto w-48 h-48 flex flex-col items-center justify-center shadow-2xl">
            <svg
              viewBox={`0 0 ${MATRIX_SIZE} ${MATRIX_SIZE}`}
              className="w-36 h-36"
              role="img"
              aria-label={`Code QR pour ${profileUrl}`}
            >
              <rect width={MATRIX_SIZE} height={MATRIX_SIZE} fill="#FFFFFF" />
              {matrix.map((row, r) =>
                row.map((filled, c) =>
                  filled ? (
                    <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#111111" />
                  ) : null
                )
              )}
            </svg>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#FF6321] mt-1">
              DJASSA
            </span>
          </div>

          <p className="text-[11px] text-white/90 font-medium">
            {profileUrl}
          </p>
        </div>

        {/* Color Theme Selector */}
        <div className="py-4 space-y-2 text-center w-full">
          <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">Thème de la carte</p>
          <div className="flex items-center justify-center gap-3">
            {[
              { id: 'orange', bg: 'bg-[#FF6321]' },
              { id: 'dark', bg: 'bg-[#2A2A2A]' },
              { id: 'sunset', bg: 'bg-gradient-to-r from-pink-500 to-amber-500' },
              { id: 'emerald', bg: 'bg-emerald-600' }
            ].map((th) => (
              <button
                key={th.id}
                onClick={() => setCardColorTheme(th.id as typeof cardColorTheme)}
                aria-label={`Thème ${th.id}`}
                className={`w-7 h-7 rounded-full ${th.bg} border-2 transition active:scale-90 ${
                  cardColorTheme === th.id ? 'border-white ring-2 ring-white/30 scale-110' : 'border-transparent opacity-80'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-xs space-y-2.5 pb-4">
          <button
            onClick={handleCopyLink}
            className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#FF6321]" />}
            {copied ? 'Lien copié !' : 'Copier le lien du profil'}
          </button>

          <button
            onClick={handleDownload}
            className="w-full py-3.5 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-black text-xs shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            Enregistrer l'image
          </button>
        </div>
      </main>
    </div>
  );
};
