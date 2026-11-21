import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Send,
  Heart,
  Mic,
  Smile,
  Image as ImageIcon,
  Play,
  Pause,
  Square,
  Trash2,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Upload,
  Link as LinkIcon,
  RefreshCw,
  Volume2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VideoComment, VideoCommentReply } from '../../types';
import { audioService } from '../../services/audioService';
import { formatMetricCount } from '../../services/marketServices';

interface CommentsBottomSheetProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
}

// Curated list of popular animated GIFs for quick reaction & social commerce
const CURATED_GIFS = [
  {
    id: 'gif-1',
    title: 'Danse Joie & Wax',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    category: 'Vibe'
  },
  {
    id: 'gif-2',
    title: 'Applaudissements & Bravo',
    url: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif',
    category: 'Bravo'
  },
  {
    id: 'gif-3',
    title: 'Coup de Cœur Amour',
    url: 'https://media.giphy.com/media/26BRv0ThflsDTqUXa/giphy.gif',
    category: 'Amour'
  },
  {
    id: 'gif-4',
    title: 'Shopping Fever',
    url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    category: 'Shopping'
  },
  {
    id: 'gif-5',
    title: 'Wow Incroyable',
    url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
    category: 'Vibe'
  },
  {
    id: 'gif-6',
    title: 'Célébration Flamme',
    url: 'https://media.giphy.com/media/13hxeOYjoTWtK8/giphy.gif',
    category: 'Bravo'
  },
  {
    id: 'gif-7',
    title: 'Satisfaction & Style',
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
    category: 'Shopping'
  },
  {
    id: 'gif-8',
    title: 'Validation Pouce En Haut',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    category: 'Bravo'
  }
];

// Quick reaction emojis
const QUICK_EMOJIS = ['❤️', '🔥', '😍', '👏', '👗', '🛍️', '😂', '👍', '✨', '💯', '🇨🇮', '🥰', '🙌', '🤩'];

// Categorized emojis for full picker
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎', '🥳', '🤯', '🥺', '🤤', '🤗', '🤭', '😏']
  },
  {
    name: 'Gestes',
    emojis: ['👍', '👎', '👏', '🙌', '👐', '🤝', '✌️', '🤞', '🤟', '🤙', '👈', '👉', '☝️', '✋', '👋', '💪', '🙏', '💅', '💃', '🕺']
  },
  {
    name: 'Mode & Marché',
    emojis: ['👗', '👘', '🥻', '👚', '👕', '👔', '👖', '👠', '👡', '👢', '👞', '👟', '👑', '💍', '👛', '👜', '👝', '🎒', '🕶️', '🛍️', '🏷️', '📦', '🛵']
  },
  {
    name: 'Amour & Côte d’Ivoire',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💘', '🇨🇮', '🌍', '☀️', '✨', '⭐', '🔥', '💯', '💎', '💰', '💵', '🏆']
  }
];

export const CommentsBottomSheet: React.FC<CommentsBottomSheetProps> = ({
  productId,
  isOpen,
  onClose,
  readOnly = false
}) => {
  const {
    comments,
    addComment,
    addCommentReply,
    toggleLikeComment,
    toggleLikeReply,
    userProfile,
    sellers,
    products
  } = useApp();

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const productSeller = useMemo(() => sellers.find((s) => s.id === product?.sellerId), [sellers, product]);
  const rawComments = comments[productId] || [];

  // Filter state: 'all' | 'voice' | 'gif'
  const [filterType, setFilterType] = useState<'all' | 'voice' | 'gif'>('all');

  // Comment input state
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string } | null>(null);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);

  // Expanded replies set (comment IDs whose replies are expanded)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // Panels visibility
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [emojiActiveTab, setEmojiActiveTab] = useState(0);

  // GIF Modal Tabs: 'trending' | 'import'
  const [gifModalTab, setGifModalTab] = useState<'trending' | 'import'>('trending');
  const [gifUrlInput, setGifUrlInput] = useState('');
  const [gifImportPreview, setGifImportPreview] = useState<string | null>(null);
  const [gifSearchTerm, setGifSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioVisualBars, setAudioVisualBars] = useState<number[]>([30, 45, 60, 40, 70, 50, 65, 35]);
  const [recordedVoiceData, setRecordedVoiceData] = useState<{
    audioUrl: string;
    durationSeconds: number;
    durationFormatted: string;
    transcription?: string;
  } | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Playback State (for voice notes in comments or preview)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Auto-expand replies that have items initially
  useEffect(() => {
    const idsWithReplies = rawComments.filter((c) => c.replies && c.replies.length > 0).map((c) => c.id);
    if (idsWithReplies.length > 0) {
      setExpandedReplies(new Set(idsWithReplies));
    }
  }, [productId]);

  // Clean up recording and audio on unmount or sheet close
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioService.stopPlayback();
      audioService.cancelRecording();
    };
  }, []);

  const filteredComments = useMemo(() => {
    if (filterType === 'voice') {
      return rawComments.filter((c) => Boolean(c.audioUrl || c.audioDuration));
    }
    if (filterType === 'gif') {
      return rawComments.filter((c) => Boolean(c.gifUrl));
    }
    return rawComments;
  }, [rawComments, filterType]);

  const totalCommentsCount = useMemo(() => {
    return rawComments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
  }, [rawComments]);

  const voiceCommentsCount = useMemo(() => {
    return rawComments.filter((c) => Boolean(c.audioUrl || c.audioDuration)).length;
  }, [rawComments]);

  const gifCommentsCount = useMemo(() => {
    return rawComments.filter((c) => Boolean(c.gifUrl)).length;
  }, [rawComments]);

  const toggleExpandReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // --- AUDIO RECORDING HANDLERS ---
  const handleStartRecording = async () => {
    audioService.stopPlayback();
    setPlayingAudioId(null);
    setRecordedVoiceData(null);
    setIsRecording(true);
    setRecordingSeconds(0);

    // Live volume visualizer callback
    const res = await audioService.startRecording(
      (_level, freqs) => {
        if (freqs && freqs.length > 0) {
          setAudioVisualBars(freqs.slice(0, 10));
        }
      },
      (transcription) => {
        if (transcription) {
          setRecordedVoiceData((prev) => prev ? { ...prev, transcription } : prev);
        }
      }
    );

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => {
        if (s >= 60) {
          // Auto-stop at 60s
          handleStopRecording();
          return s;
        }
        return s + 1;
      });
    }, 1000);
  };

  const handleStopRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    const result = await audioService.stopRecording(recordingSeconds);
    if (result) {
      setRecordedVoiceData(result);
    }
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioService.cancelRecording();
    setRecordedVoiceData(null);
  };

  // --- AUDIO PLAYBACK HANDLERS ---
  const handleTogglePlayAudio = (id: string, audioUrl?: string, transcription?: string, durationSec?: number) => {
    if (playingAudioId === id) {
      audioService.stopPlayback();
      setPlayingAudioId(null);
      setAudioProgress(0);
    } else {
      audioService.stopPlayback();
      setPlayingAudioId(id);
      setAudioProgress(0);

      const targetText = transcription || 'Message vocal de client sur Djassa';
      audioService.playAudio(
        id,
        audioUrl,
        targetText,
        playbackSpeed,
        (current, total) => {
          const ratio = total > 0 ? (current / total) * 100 : 0;
          setAudioProgress(Math.min(100, ratio));
        },
        () => {
          setPlayingAudioId(null);
          setAudioProgress(0);
        }
      );
    }
  };

  const handleCyclePlaybackSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (playingAudioId) {
      // Re-trigger with new speed
      audioService.stopPlayback();
      setPlayingAudioId(null);
    }
  };

  // --- SUBMIT COMMENT HANDLER ---
  const handleSubmitComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const text = inputText.trim();
    const hasAudio = Boolean(recordedVoiceData);
    const hasGif = Boolean(selectedGifUrl);

    if (!text && !hasAudio && !hasGif) return;

    const fallbackContent = hasAudio
      ? `🎤 Note vocale (${recordedVoiceData?.durationFormatted || '0:08'})`
      : hasGif
      ? '🎬 GIF réaction'
      : text;

    const finalContent = text || fallbackContent;

    const options = {
      audioUrl: recordedVoiceData?.audioUrl,
      audioDuration: recordedVoiceData?.durationSeconds,
      gifUrl: selectedGifUrl || undefined,
      transcription: recordedVoiceData?.transcription
    };

    if (replyingTo) {
      addCommentReply(productId, replyingTo.commentId, finalContent, replyingTo.userName, options);
      setReplyingTo(null);
    } else {
      addComment(productId, finalContent, options);
    }

    // Reset input states
    setInputText('');
    setSelectedGifUrl(null);
    setRecordedVoiceData(null);
    setShowEmojiPicker(false);
    setShowGifModal(false);
  };

  // --- GIF IMPORT / UPLOAD HANDLERS ---
  const handleLocalGifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('Veuillez sélectionner un GIF de moins de 8 Mo');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setGifImportPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmImportedGif = () => {
    const target = gifImportPreview || gifUrlInput.trim();
    if (!target) return;
    setSelectedGifUrl(target);
    setShowGifModal(false);
    setGifImportPreview(null);
    setGifUrlInput('');
  };

  const handleSelectCuratedGif = (url: string) => {
    setSelectedGifUrl(url);
    setShowGifModal(false);
  };

  const handleQuickEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  if (!isOpen) return null;

  return (
    <div
      id="comment-bottom-sheet-container"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[85vh] sm:max-h-[80vh] bg-[#141414] rounded-t-3xl border-t border-white/15 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DRAG HANDLE & HEADER */}
        <div className="pt-2 px-4 pb-3 border-b border-white/10 shrink-0">
          <div className="w-12 h-1 bg-white/25 rounded-full mx-auto mb-2" />

          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-extrabold text-white">
                Commentaires
              </span>
              <span className="text-xs font-semibold text-[#FF6321]">
                ({formatMetricCount(totalCommentsCount)})
              </span>
            </div>

            {/* Filter segmented buttons */}
            <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition ${
                  filterType === 'all'
                    ? 'bg-[#FF6321] text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFilterType('voice')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition flex items-center gap-1 ${
                  filterType === 'voice'
                    ? 'bg-[#FF6321] text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Mic className="w-3 h-3" />
                <span>Vocaux ({formatMetricCount(voiceCommentsCount)})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('gif')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition flex items-center gap-1 ${
                  filterType === 'gif'
                    ? 'bg-[#FF6321] text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <span>GIFs ({formatMetricCount(gifCommentsCount)})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition"
              title="Fermer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* COMMENTS LIST SCROLLER */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 no-scrollbar">
          {filteredComments.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-white/50">
              <Sparkles className="w-8 h-8 text-[#FF6321] mx-auto opacity-70 mb-1" />
              <p className="text-sm font-bold text-white/90">
                {filterType === 'voice'
                  ? 'Aucun message vocal pour le moment'
                  : filterType === 'gif'
                  ? 'Aucun GIF pour le moment'
                  : 'Soyez le premier à commenter !'}
              </p>
              <p className="text-xs text-white/50 max-w-xs mx-auto">
                Partagez votre avis, posez une question en vocal ou réagissez avec des emojis et des GIFs importés.
              </p>
            </div>
          ) : (
            filteredComments.map((comm) => {
              const isSellerComment = comm.userId === productSeller?.id || comm.userName.includes('Boutique');
              const hasReplies = comm.replies && comm.replies.length > 0;
              const isExpanded = expandedReplies.has(comm.id);
              const isPlayingThisAudio = playingAudioId === comm.id;

              return (
                <div key={comm.id} className="space-y-2 group">
                  {/* MAIN COMMENT ROW */}
                  <div className="flex items-start gap-2.5">
                    <img
                      src={comm.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt={comm.userName}
                      className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      {/* Name & Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white/90 truncate">
                          {comm.userName}
                        </span>
                        {isSellerComment && (
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
                            Vendeur
                          </span>
                        )}
                        <span className="text-[10px] text-white/40">
                          · {comm.timestamp}
                        </span>
                      </div>

                      {/* Comment text */}
                      {comm.content && (
                        <p className="text-xs text-white/90 mt-1 whitespace-pre-wrap leading-relaxed break-words">
                          {comm.content}
                        </p>
                      )}

                      {/* VOICE NOTE PLAYER (VOCAL) */}
                      {(comm.audioUrl || comm.audioDuration) && (
                        <div className="mt-2 p-2.5 rounded-2xl bg-neutral-900 border border-white/15 max-w-sm space-y-2">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleTogglePlayAudio(
                                comm.id,
                                comm.audioUrl,
                                comm.transcription || comm.content,
                                comm.audioDuration || 8
                              )}
                              className="w-9 h-9 rounded-full bg-[#FF6321] hover:bg-[#ff7538] text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition"
                              title={isPlayingThisAudio ? 'Mettre en pause' : 'Écouter le vocal'}
                            >
                              {isPlayingThisAudio ? (
                                <Pause className="w-4 h-4 fill-white" />
                              ) : (
                                <Play className="w-4 h-4 fill-white ml-0.5" />
                              )}
                            </button>

                            {/* Animated waveform bars */}
                            <div className="flex-1 flex items-center gap-0.5 h-6">
                              {[35, 55, 75, 45, 90, 65, 40, 80, 50, 70, 85, 40, 60, 75, 50, 65].map((h, i) => {
                                const barProgress = (i / 16) * 100;
                                const isPassed = isPlayingThisAudio && audioProgress >= barProgress;
                                return (
                                  <div
                                    key={i}
                                    style={{ height: `${h}%` }}
                                    className={`w-1 rounded-full transition-all duration-150 ${
                                      isPassed
                                        ? 'bg-[#FF6321]'
                                        : isPlayingThisAudio
                                        ? 'bg-orange-300/60 animate-pulse'
                                        : 'bg-white/30'
                                    }`}
                                  />
                                );
                              })}
                            </div>

                            {/* Duration & Speed */}
                            <div className="flex flex-col items-end shrink-0">
                              <span className="text-[10px] font-mono font-bold text-white/80">
                                0:0{comm.audioDuration || 8}
                              </span>
                              {isPlayingThisAudio && (
                                <button
                                  type="button"
                                  onClick={handleCyclePlaybackSpeed}
                                  className="text-[9px] font-bold text-[#FF6321] hover:underline"
                                >
                                  {playbackSpeed}x
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Transcription / Caption pill */}
                          {comm.transcription && (
                            <p className="text-[11px] text-white/70 italic bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                              « {comm.transcription} »
                            </p>
                          )}
                        </div>
                      )}

                      {/* GIF CONTAINER */}
                      {comm.gifUrl && (
                        <div className="mt-2 max-w-[220px] rounded-2xl overflow-hidden border border-white/20 shadow-lg bg-black">
                          <img
                            src={comm.gifUrl}
                            alt="GIF"
                            className="w-full h-auto object-cover max-h-48"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* ACTIONS ROW: Reply + Like */}
                      <div className="flex items-center gap-4 mt-2">
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo({ commentId: comm.id, userName: comm.userName });
                              setInputText(`@${comm.userName} `);
                            }}
                            className="text-[11px] font-bold text-white/50 hover:text-[#FF6321] transition active:scale-95"
                          >
                            Répondre
                          </button>
                        )}

                        {/* Expand/Collapse replies toggle */}
                        {hasReplies && (
                          <button
                            type="button"
                            onClick={() => toggleExpandReplies(comm.id)}
                            className="text-[11px] font-bold text-[#FF6321] hover:underline flex items-center gap-1"
                          >
                            <span>
                              {isExpanded
                                ? 'Masquer'
                                : `Voir ${comm.replies.length} réponse${comm.replies.length > 1 ? 's' : ''}`}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* HEART LIKE DISPLAY OR BUTTON (TIKTOK STYLE) */}
                    {readOnly ? (
                      <div
                        className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center text-white/60 cursor-default select-none"
                        title="J'aime (Observation uniquement)"
                      >
                        <Heart className="w-4 h-4 text-white/60" />
                        <span className="text-[10px] font-bold mt-0.5 text-white/50">
                          {formatMetricCount(comm.likesCount)}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleLikeComment(productId, comm.id)}
                        className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center text-white/60 hover:text-white transition active:scale-90"
                        title={comm.isLikedByMe ? 'Ne plus aimer' : 'Aimer ce commentaire'}
                      >
                        <Heart
                          className={`w-4 h-4 transition-transform duration-200 ${
                            comm.isLikedByMe
                              ? 'text-[#FE2C55] fill-[#FE2C55] scale-110'
                              : 'text-white/60 hover:text-white'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold mt-0.5 ${
                            comm.isLikedByMe ? 'text-[#FE2C55]' : 'text-white/50'
                          }`}
                        >
                          {formatMetricCount(comm.likesCount)}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* NESTED REPLIES */}
                  {hasReplies && isExpanded && (
                    <div className="ml-10 space-y-2.5 pl-2 border-l-2 border-white/10 pt-1">
                      {comm.replies.map((reply: VideoCommentReply) => {
                        const isSellerReply = reply.userId === productSeller?.id || reply.userName.includes('Boutique');
                        const isPlayingReplyAudio = playingAudioId === reply.id;

                        return (
                          <div key={reply.id} className="flex items-start gap-2.5">
                            <img
                              src={reply.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                              alt={reply.userName}
                              className="w-7 h-7 rounded-full object-cover border border-white/15 shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[11px] font-bold truncate ${
                                  isSellerReply ? 'text-[#FF6321]' : 'text-white/90'
                                }`}>
                                  {reply.userName}
                                </span>
                                {isSellerReply && (
                                  <span className="text-[9px] font-black px-1 rounded bg-[#FF6321]/20 text-[#FF6321]">
                                    Vendeur
                                  </span>
                                )}
                                <span className="text-[9px] text-white/40">
                                  · {reply.timestamp}
                                </span>
                              </div>

                              <p className="text-[11px] text-white/90 mt-0.5 whitespace-pre-wrap leading-relaxed break-words">
                                {reply.replyToUserName && (
                                  <span className="text-[#FF6321] font-semibold mr-1">
                                    @{reply.replyToUserName}
                                  </span>
                                )}
                                {reply.content}
                              </p>

                              {/* Voice note in reply */}
                              {(reply.audioUrl || reply.audioDuration) && (
                                <div className="mt-1.5 p-2 rounded-xl bg-neutral-900 border border-white/15 max-w-xs flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePlayAudio(
                                      reply.id,
                                      reply.audioUrl,
                                      reply.transcription || reply.content,
                                      reply.audioDuration || 6
                                    )}
                                    className="w-7 h-7 rounded-full bg-[#FF6321] text-white flex items-center justify-center shrink-0 shadow active:scale-95"
                                  >
                                    {isPlayingReplyAudio ? (
                                      <Pause className="w-3 h-3 fill-white" />
                                    ) : (
                                      <Play className="w-3 h-3 fill-white ml-0.5" />
                                    )}
                                  </button>
                                  <div className="flex-1 flex items-center gap-0.5 h-4">
                                    {[30, 60, 80, 50, 90, 40, 70, 50].map((h, i) => (
                                      <div
                                        key={i}
                                        style={{ height: `${h}%` }}
                                        className={`w-1 rounded-full ${
                                          isPlayingReplyAudio ? 'bg-[#FF6321]' : 'bg-white/30'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[9px] font-mono text-white/60">
                                    0:0{reply.audioDuration || 6}
                                  </span>
                                </div>
                              )}

                              {/* GIF in reply */}
                              {reply.gifUrl && (
                                <div className="mt-1.5 max-w-[180px] rounded-xl overflow-hidden border border-white/20">
                                  <img src={reply.gifUrl} alt="GIF" className="w-full h-auto" />
                                </div>
                              )}

                              {!readOnly && (
                                <div className="flex items-center gap-3 mt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingTo({ commentId: comm.id, userName: reply.userName });
                                      setInputText(`@${reply.userName} `);
                                    }}
                                    className="text-[10px] font-bold text-white/40 hover:text-[#FF6321] transition"
                                  >
                                    Répondre
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Reply Heart Like */}
                            {readOnly ? (
                              <div
                                className="min-h-[40px] min-w-[36px] flex flex-col items-center justify-center text-white/50 cursor-default select-none"
                                title="J'aime (Observation uniquement)"
                              >
                                <Heart className="w-3.5 h-3.5 text-white/50" />
                                <span className="text-[9px] font-bold mt-0.5 text-white/40">
                                  {formatMetricCount(reply.likesCount)}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleLikeReply(productId, comm.id, reply.id)}
                                className="min-h-[40px] min-w-[36px] flex flex-col items-center justify-center text-white/60 hover:text-white transition active:scale-90"
                                title={reply.isLikedByMe ? 'Ne plus aimer' : 'Aimer'}
                              >
                                <Heart
                                  className={`w-3.5 h-3.5 ${
                                    reply.isLikedByMe
                                      ? 'text-[#FE2C55] fill-[#FE2C55]'
                                      : 'text-white/50'
                                  }`}
                                />
                                <span className={`text-[9px] font-bold mt-0.5 ${
                                  reply.isLikedByMe ? 'text-[#FE2C55]' : 'text-white/40'
                                }`}>
                                  {formatMetricCount(reply.likesCount)}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* REACTION PREVIEW / ATTACHMENTS BAR */}
        {selectedGifUrl && (
          <div className="px-4 py-2 bg-neutral-900 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80 font-bold flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-[#FF6321]" />
                GIF sélectionné
              </span>
              <img
                src={selectedGifUrl}
                alt="Selected GIF"
                className="w-8 h-8 rounded-lg object-cover border border-white/20"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedGifUrl(null)}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10"
              title="Supprimer le GIF"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* VOICE RECORDED PREVIEW (READY TO SEND) */}
        {recordedVoiceData && !isRecording && (
          <div className="px-4 py-2 bg-neutral-900 border-t border-white/10 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleTogglePlayAudio('preview-recording', recordedVoiceData.audioUrl, recordedVoiceData.transcription, recordedVoiceData.durationSeconds)}
                className="w-8 h-8 rounded-full bg-[#FF6321] text-white flex items-center justify-center shrink-0 shadow active:scale-95"
              >
                {playingAudioId === 'preview-recording' ? (
                  <Pause className="w-3.5 h-3.5 fill-white" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                )}
              </button>
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  <Mic className="w-3 h-3 text-[#FF6321]" />
                  Vocal prêt ({recordedVoiceData.durationFormatted})
                </span>
                {recordedVoiceData.transcription && (
                  <p className="text-[10px] text-white/60 italic max-w-xs truncate">
                    « {recordedVoiceData.transcription} »
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                className="p-1.5 rounded-full text-rose-400 hover:bg-rose-500/10 active:scale-95"
                title="Supprimer ce vocal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleSubmitComment()}
                className="px-3 py-1 rounded-full bg-[#FF6321] text-white text-xs font-bold shadow flex items-center gap-1 active:scale-95"
              >
                <span>Envoyer</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* REPLYING BANNER */}
        {replyingTo && (
          <div className="px-4 py-1.5 bg-black/60 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-white/70">
              En réponse à <strong className="text-[#FF6321]">@{replyingTo.userName}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setInputText('');
              }}
              className="text-white/40 hover:text-white text-[11px]"
            >
              Annuler
            </button>
          </div>
        )}

        {/* QUICK EMOJI HORIZONTAL BAR */}
        {!readOnly && (
          <div className="px-4 py-1.5 bg-[#171717] border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0">
              Émojis :
            </span>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickEmojiClick(emoji)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-base transition active:scale-125 shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* FULL EMOJI PICKER DRAWER */}
        {showEmojiPicker && (
          <div className="px-4 py-3 bg-[#181818] border-t border-white/10 animate-in slide-in-from-bottom-2 duration-150">
            {/* Category tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-2 border-b border-white/10">
              {EMOJI_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setEmojiActiveTab(idx)}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                    emojiActiveTab === idx
                      ? 'bg-[#FF6321] text-white shadow'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Grid of emojis */}
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-36 overflow-y-auto no-scrollbar py-1">
              {EMOJI_CATEGORIES[emojiActiveTab].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleQuickEmojiClick(emoji)}
                  className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-xl transition active:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LIVE RECORDING HUD (WHEN MICROPHONE IS ACTIVE) */}
        {isRecording ? (
          <div className="p-3 bg-neutral-900 border-t border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-400">Enregistrement vocal</span>
                  <span className="text-xs font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded-full border border-white/10">
                    00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 h-3">
                  {audioVisualBars.map((b, i) => (
                    <div
                      key={i}
                      style={{ height: `${Math.max(20, b)}%` }}
                      className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                className="px-3 py-1.5 rounded-full bg-white/10 text-white/70 hover:text-white text-xs font-bold active:scale-95 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Terminer</span>
              </button>
            </div>
          </div>
        ) : readOnly ? (
          <div className="p-3.5 bg-neutral-950 border-t border-white/10 text-center text-xs text-white/50 shrink-0 font-medium">
            Mode observation administrateur : consultation des commentaires uniquement
          </div>
        ) : (
          /* REGULAR BOTTOM INPUT BAR */
          <form
            onSubmit={handleSubmitComment}
            className="p-3 bg-neutral-950 border-t border-white/10 flex items-center gap-2 shrink-0"
          >
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-8 h-8 rounded-full object-cover border border-white/15 shrink-0"
            />

            <div className="flex-1 flex items-center bg-white/10 border border-white/15 rounded-full px-3 py-1.5 focus-within:border-[#FF6321] transition">
              <input
                id="input-comment-sheet-text"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  replyingTo
                    ? `Répondre à @${replyingTo.userName}...`
                    : 'Ajouter un commentaire...'
                }
                className="flex-1 bg-transparent text-xs text-white placeholder-white/40 focus:outline-none min-w-0"
              />

              {/* Emoji Picker toggle */}
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowGifModal(false);
                }}
                className={`p-1.5 rounded-full transition active:scale-90 ${
                  showEmojiPicker ? 'text-[#FF6321]' : 'text-white/60 hover:text-white'
                }`}
                title="Choisir un émoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* GIF Selector & Importer button */}
              <button
                type="button"
                onClick={() => {
                  setShowGifModal(true);
                  setShowEmojiPicker(false);
                }}
                className={`px-1.5 py-0.5 rounded text-[11px] font-black transition active:scale-90 border ${
                  selectedGifUrl
                    ? 'bg-[#FF6321] text-white border-[#FF6321]'
                    : 'text-white/70 border-white/30 hover:text-white hover:border-white'
                }`}
                title="Ajouter ou importer un GIF"
              >
                GIF
              </button>
            </div>

            {/* Vocal Microphone Button */}
            <button
              type="button"
              onClick={handleStartRecording}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-[#FF6321] active:scale-90 transition shadow"
              title="Enregistrer un vocal"
              aria-label="Enregistrer un vocal"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Submit Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() && !selectedGifUrl && !recordedVoiceData}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[#FF6321] text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-[#ff7538] active:scale-90 transition shadow-lg shadow-orange-600/20"
              title="Publier"
              aria-label="Publier"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* MODAL: GIF HUB & CUSTOM IMPORT ("des gif importe") */}
        {showGifModal && (
          <div
            className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-3 animate-in fade-in duration-150"
            onClick={() => setShowGifModal(false)}
          >
            <div
              className="w-full max-w-lg mx-auto bg-[#181818] rounded-3xl border border-white/20 p-4 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm">
                    GIFs & Animations
                  </span>
                  <span className="text-[10px] bg-[#FF6321]/20 text-[#FF6321] px-2 py-0.5 rounded-full font-bold">
                    Adjamé Vibes
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGifModal(false)}
                  className="p-1 rounded-full text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* TABS: Tendances vs Importer un GIF */}
              <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setGifModalTab('trending')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    gifModalTab === 'trending'
                      ? 'bg-[#FF6321] text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Tendances & Réactions
                </button>
                <button
                  type="button"
                  onClick={() => setGifModalTab('import')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    gifModalTab === 'import'
                      ? 'bg-[#FF6321] text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importer un GIF</span>
                </button>
              </div>

              {/* TAB 1: CURATED TRENDING GIFS */}
              {gifModalTab === 'trending' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={gifSearchTerm}
                    onChange={(e) => setGifSearchTerm(e.target.value)}
                    placeholder="Filtrer les GIFs (style, bravo, rire...)"
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto no-scrollbar py-1">
                    {CURATED_GIFS.filter((g) =>
                      gifSearchTerm
                        ? g.title.toLowerCase().includes(gifSearchTerm.toLowerCase()) ||
                          g.category.toLowerCase().includes(gifSearchTerm.toLowerCase())
                        : true
                    ).map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => handleSelectCuratedGif(gif.url)}
                        className="group relative rounded-xl overflow-hidden border border-white/15 hover:border-[#FF6321] aspect-video bg-black focus:outline-none active:scale-95 transition"
                      >
                        <img
                          src={gif.url}
                          alt={gif.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-left">
                          <span className="text-[10px] font-bold text-white line-clamp-1">
                            {gif.title}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* TAB 2: IMPORT CUSTOM GIF (FILE OR URL) */
                <div className="space-y-3 py-1">
                  {/* Option A: Upload local file */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/25 hover:border-[#FF6321] rounded-2xl p-4 text-center cursor-pointer bg-white/5 hover:bg-white/10 transition group"
                  >
                    <Upload className="w-6 h-6 text-[#FF6321] mx-auto mb-1 group-hover:scale-110 transition" />
                    <p className="text-xs font-bold text-white">
                      Cliquez pour choisir un GIF depuis vos fichiers
                    </p>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      Supporte .gif, .webp, .png animés (Max 8 Mo)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/gif,image/webp,image/png,image/jpeg"
                      onChange={handleLocalGifUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Option B: Paste external GIF URL */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/70 flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 text-[#FF6321]" />
                      Ou collez le lien direct d'un GIF :
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={gifUrlInput}
                        onChange={(e) => {
                          setGifUrlInput(e.target.value);
                          setGifImportPreview(null);
                        }}
                        placeholder="https://media.giphy.com/.../giphy.gif"
                        className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>

                  {/* LIVE PREVIEW OF IMPORTED GIF */}
                  {(gifImportPreview || gifUrlInput.trim()) && (
                    <div className="p-2 bg-black/60 rounded-2xl border border-white/15 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={gifImportPreview || gifUrlInput.trim()}
                          alt="Prévisualisation GIF"
                          className="w-14 h-14 object-cover rounded-xl border border-white/20"
                          onError={() => {
                            // If invalid URL, fallback
                          }}
                        />
                        <div>
                          <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> GIF prêt à être inséré
                          </p>
                          <p className="text-[10px] text-white/50">
                            Sera joint à votre commentaire
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmImportedGif}
                        className="px-3.5 py-1.5 rounded-full bg-[#FF6321] text-white text-xs font-bold shadow hover:bg-[#ff7538] active:scale-95 transition"
                      >
                        Valider ce GIF
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
