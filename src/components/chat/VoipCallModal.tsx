import React from 'react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  Minimize2, 
  Maximize2, 
  MessageSquare,
  Radio
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const VoipCallModal: React.FC = () => {
  const { 
    activeCall, 
    endCall, 
    acceptCall, 
    rejectCall, 
    toggleCallMute, 
    toggleCallSpeaker, 
    toggleCallMinimized 
  } = useApp();

  if (!activeCall) return null;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isIncoming = activeCall.direction === 'incoming';
  const isRinging = activeCall.status === 'ringing' || activeCall.status === 'connecting';
  const isConnected = activeCall.status === 'connected';

  // 1. Minimized Call Bar (when user minimized the call to chat simultaneously)
  if (activeCall.isMinimized) {
    return (
      <div 
        id="voip-call-minimized-bar"
        className="w-full bg-[#161616] border-b border-emerald-500/30 px-3 py-2 flex items-center justify-between gap-2 text-white shrink-0 shadow-lg z-30 animate-slideDown"
      >
        <div 
          onClick={toggleCallMinimized}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-90 transition"
        >
          <div className="relative shrink-0">
            <img 
              src={activeCall.participantAvatar} 
              alt={activeCall.participantName} 
              className="w-8 h-8 rounded-full object-cover border border-emerald-500"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-[#161616]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[220px]">
                {activeCall.participantName}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded">
                {isConnected ? formatSeconds(activeCall.durationSeconds) : isIncoming ? 'Entrant...' : 'Sonnerie...'}
              </span>
            </div>
            <p className="text-[10px] text-white/50 truncate flex items-center gap-1">
              <span>Appel en cours • Toucher pour agrandir</span>
            </p>
          </div>
        </div>

        {/* Quick controls in minimized mode */}
        <div className="flex items-center gap-1 shrink-0">
          {isConnected && (
            <button
              onClick={toggleCallMute}
              className={`p-2 rounded-xl transition ${
                activeCall.isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
              title={activeCall.isMuted ? 'Micro désactivé' : 'Couper le micro'}
            >
              {activeCall.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {isIncoming && isRinging ? (
            <button
              onClick={acceptCall}
              className="p-2 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-md animate-bounce flex items-center gap-1"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Décrocher</span>
            </button>
          ) : (
            <button
              onClick={endCall}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-md"
              title="Raccrocher"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={toggleCallMinimized}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
            title="Agrandir l'appel"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Full Embedded Call Screen (takes over Discussions page container)
  return (
    <div
      id="voip-call-discussion-overlay"
      className="absolute inset-0 z-40 bg-[#0A0A0A]/98 backdrop-blur-2xl flex flex-col items-center justify-between p-6 sm:p-8 text-white animate-fadeIn"
    >
      {/* Top Bar: Encrypted shield + Minimize to Chat button */}
      <div className="w-full flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Appel chiffré Djassa</span>
        </div>

        {isConnected && (
          <button
            id="btn-minimize-call-to-chat"
            onClick={toggleCallMinimized}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-semibold transition border border-white/10 active:scale-95"
            title="Réduire pour écrire des messages"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#FF6321]" />
            <span>Écrire un message</span>
            <Minimize2 className="w-3.5 h-3.5 ml-0.5 text-white/50" />
          </button>
        )}
      </div>

      {/* Caller / Contact Identity */}
      <div className="flex flex-col items-center space-y-2 text-center my-auto">
        <h2 className="text-xl sm:text-2xl font-black text-white">{activeCall.participantName}</h2>
        <p className="text-xs sm:text-sm text-white/60 font-medium">{activeCall.participantRole}</p>

        {/* Live status badge */}
        <div className="pt-2">
          {isConnected ? (
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-mono font-black text-emerald-400">
                {formatSeconds(activeCall.durationSeconds)}
              </span>
            </div>
          ) : isIncoming ? (
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 px-4 py-1.5 rounded-full animate-pulse">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-xs font-bold text-amber-300">
                Appel vocal entrant...
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-[#FF6321]/15 border border-[#FF6321]/30 px-4 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#FF6321] animate-ping" />
              <span className="text-xs font-bold text-[#FF6321]">
                Sonnerie en cours...
              </span>
            </div>
          )}
        </div>

        {/* Avatar with pulsing waves */}
        <div className="relative flex items-center justify-center pt-6 pb-2">
          <div className={`absolute w-36 h-36 rounded-full ${isRinging ? 'bg-[#FF6321]/25 animate-ping' : 'bg-emerald-500/15'}`} />
          <div className={`absolute w-28 h-28 rounded-full ${isRinging ? 'bg-[#FF6321]/35 animate-pulse' : 'bg-emerald-500/25'}`} />
          <img
            src={activeCall.participantAvatar}
            alt={activeCall.participantName}
            className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 ${
              isConnected ? 'border-emerald-500' : isIncoming ? 'border-amber-400' : 'border-[#FF6321]'
            } shadow-2xl`}
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-sm flex flex-col items-center gap-4 pb-6">
        {/* CASE A: INCOMING CALL (RINGING) -> ACCEPT (Green) OR DECLINE (Red) */}
        {isIncoming && isRinging && (
          <div className="w-full flex items-center justify-around px-4">
            {/* Decline */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                id="btn-reject-incoming-call"
                onClick={rejectCall}
                className="p-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/40 active:scale-95 transition"
                title="Refuser"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-[11px] font-bold text-white/70">Refuser</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                id="btn-accept-incoming-call"
                onClick={acceptCall}
                className="p-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/40 active:scale-95 transition animate-bounce"
                title="Décrocher"
              >
                <Phone className="w-7 h-7" />
              </button>
              <span className="text-[11px] font-bold text-emerald-400">Décrocher</span>
            </div>
          </div>
        )}

        {/* CASE B: OUTGOING CALL (RINGING) OR CONNECTED CALL */}
        {(!isIncoming || isConnected) && (
          <div className="w-full flex items-center justify-around px-4">
            {/* Mute toggle */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                id="btn-call-mute-toggle"
                onClick={toggleCallMute}
                className={`p-4 rounded-full border transition active:scale-95 ${
                  activeCall.isMuted
                    ? 'bg-rose-500 text-white border-rose-600'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
                title={activeCall.isMuted ? 'Micro coupé' : 'Couper le micro'}
              >
                {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <span className="text-[10px] text-white/60">{activeCall.isMuted ? 'Muet' : 'Micro'}</span>
            </div>

            {/* End / Cancel Call Button */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                id="btn-end-active-call"
                onClick={endCall}
                className="p-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-2xl shadow-rose-600/50 hover:scale-105 active:scale-95 transition"
                title="Raccrocher"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-[10px] text-white/70">Raccrocher</span>
            </div>

            {/* Speaker toggle */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                id="btn-call-speaker-toggle"
                onClick={toggleCallSpeaker}
                className={`p-4 rounded-full border transition active:scale-95 ${
                  activeCall.isSpeaker
                    ? 'bg-[#FF6321] text-white border-orange-600'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
                title={activeCall.isSpeaker ? 'Haut-parleur actif' : 'Activer le haut-parleur'}
              >
                {activeCall.isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <span className="text-[10px] text-white/60">Haut-parleur</span>
            </div>
          </div>
        )}

        {/* Small tip */}
        <p className="text-[10px] text-white/40 text-center">
          Tous vos appels et messages sont gérés au même endroit sur la page discussion.
        </p>
      </div>
    </div>
  );
};
