import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Heart,
  MessageCircle,
  MessageSquare,
  Package,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  UserCheck,
  UserPlus,
  Wand2,
  X
} from 'lucide-react';
import { useApp, type GuestAuthGateReason } from '../../context/AppContext';
import {
  VISITOR_AI_EXHAUSTED_MESSAGE,
  VISITOR_COMMENTS_GATE_MESSAGE,
  VISITOR_QUOTAS
} from '../../config/visitorQuotas';
import { ConnectionScreen } from '../profile/ConnectionScreen';

interface GateCopy {
  title: string;
  message: string;
  dismissLabel: string;
  badgeLabel: string;
}

function getGateCopy(reason: GuestAuthGateReason): GateCopy {
  switch (reason) {
    case 'comment':
      return {
        title: 'Rejoins la discussion DJASSA',
        message: VISITOR_COMMENTS_GATE_MESSAGE,
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Communauté DJASSA'
      };
    case 'ai_quota':
      return {
        title: 'Questions gratuites utilisées',
        message: VISITOR_AI_EXHAUSTED_MESSAGE,
        dismissLabel: 'Revenir plus tard',
        badgeLabel: `Limite ${VISITOR_QUOTAS.dailyAiQuestions}/${VISITOR_QUOTAS.dailyAiQuestions} du jour`
      };
    case 'like_limit':
      return {
        title: 'Limite quotidienne atteinte',
        message: `Vous avez utilisé vos ${VISITOR_QUOTAS.dailyLikes} J'aime gratuits d'aujourd'hui. Connectez-vous ou créez un compte DJASSA pour aimer sans limite et sauvegarder vos coups de cœur.`,
        dismissLabel: 'Continuer à explorer',
        badgeLabel: `Mode visiteur • ${VISITOR_QUOTAS.dailyLikes}/${VISITOR_QUOTAS.dailyLikes} J'aime`
      };
    case 'favorite_limit':
      return {
        title: 'Limite de favoris atteinte',
        message: `Vous avez atteint votre limite de ${VISITOR_QUOTAS.dailyFavorites} produits enregistrés aujourd'hui. Connectez-vous ou créez un compte DJASSA pour conserver tous vos favoris.`,
        dismissLabel: 'Continuer à explorer',
        badgeLabel: `Mode visiteur • ${VISITOR_QUOTAS.dailyFavorites}/${VISITOR_QUOTAS.dailyFavorites} Favoris`
      };
    case 'purchase':
      return {
        title: 'Finalisez votre achat sur DJASSA',
        message:
          'Connectez-vous ou créez un compte en quelques secondes pour passer votre commande, choisir votre adresse à Abidjan et suivre votre livraison.',
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Commande sécurisée'
      };
    case 'cart':
      return {
        title: 'Enregistrez votre panier',
        message:
          'Connectez-vous ou créez un compte DJASSA pour ajouter des articles à votre panier et retrouver votre sélection sur tous vos appareils.',
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Panier DJASSA'
      };
    case 'orders':
      return {
        title: 'Accédez à vos achats et commandes',
        message:
          'Connectez-vous ou créez un compte DJASSA pour consulter votre panier, payer en toute sécurité et suivre vos commandes en temps réel.',
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Mes achats'
      };
    case 'messages':
      return {
        title: 'Discutez avec les vendeurs',
        message:
          'Connectez-vous ou créez un compte DJASSA pour envoyer des messages aux boutiques d’Adjamé, négocier ou poser vos questions en direct.',
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Messagerie directe'
      };
    case 'follow':
      return {
        title: 'Suivez vos boutiques préférées',
        message:
          'Connectez-vous ou créez un compte DJASSA pour vous abonner aux vendeurs et retrouver leurs nouveautés dans votre fil Suivi.',
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Abonnements boutiques'
      };
    case 'tryon':
      return {
        title: 'Essayage virtuel IA',
        message:
          'Connectez-vous ou créez un compte DJASSA pour lancer un essayage virtuel sur votre photo et sauvegarder vos looks.',
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Studio Try-On IA'
      };
    default:
      return {
        title: 'Rejoins DJASSA',
        message:
          'Créez votre compte ou connectez-vous pour profiter de toutes les fonctionnalités personnalisées de DJASSA.',
        dismissLabel: 'Continuer à explorer',
        badgeLabel: 'Compte DJASSA'
      };
  }
}

function renderReasonIcon(reason: GuestAuthGateReason) {
  const cls = 'w-7 h-7 text-[#FF6321]';
  switch (reason) {
    case 'comment':
      return <MessageCircle className={cls} />;
    case 'ai_quota':
      return <Sparkles className={cls} />;
    case 'like_limit':
      return <Heart className={cls} />;
    case 'favorite_limit':
      return <Bookmark className={cls} />;
    case 'purchase':
      return <ShoppingBag className={cls} />;
    case 'cart':
      return <ShoppingCart className={cls} />;
    case 'orders':
      return <Package className={cls} />;
    case 'messages':
      return <MessageSquare className={cls} />;
    case 'follow':
      return <UserPlus className={cls} />;
    case 'tryon':
      return <Wand2 className={cls} />;
    default:
      return <UserCheck className={cls} />;
  }
}

export const VisitorAuthGateModal: React.FC = () => {
  const { authGateState, closeAuthGate } = useApp();
  const [viewStage, setViewStage] = useState<'prompt' | 'auth'>('prompt');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  useEffect(() => {
    if (!authGateState.isOpen) return;
    setAuthMode(authGateState.initialMode || 'register');
    setViewStage(authGateState.directToAuthForm ? 'auth' : 'prompt');
  }, [authGateState.isOpen, authGateState.openedAt, authGateState.initialMode, authGateState.directToAuthForm]);

  if (!authGateState.isOpen) return null;

  const copy = getGateCopy(authGateState.reason);

  if (viewStage === 'auth') {
    return (
      <div
        id="visitor-auth-form-overlay"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[120] bg-[#0A0A0A]/98 backdrop-blur-xl flex flex-col animate-fadeIn"
      >
        <ConnectionScreen
          initialMode={authMode}
          contextMessage={copy.message}
          onClose={closeAuthGate}
          showExploreReturnButton
        />
      </div>
    );
  }

  return (
    <div
      id="visitor-auth-gate-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthGate();
      }}
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fadeIn"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[#121216] border border-white/15 p-6 shadow-2xl space-y-5 text-white">
        <button
          type="button"
          id="btn-close-visitor-gate"
          aria-label="Fermer"
          onClick={closeAuthGate}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center shadow-lg shadow-orange-600/15">
            {renderReasonIcon(authGateState.reason)}
          </div>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#FF854D]">
            {copy.badgeLabel}
          </span>
          <h3 className="text-lg font-black tracking-tight text-white leading-snug">
            {copy.title}
          </h3>
          <p id="visitor-gate-message" className="text-xs text-white/75 leading-relaxed">
            {copy.message}
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            id="btn-visitor-gate-register"
            onClick={() => {
              setAuthMode('register');
              setViewStage('auth');
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 transition cursor-pointer"
          >
            Créer un compte
          </button>

          <button
            type="button"
            id="btn-visitor-gate-login"
            onClick={() => {
              setAuthMode('login');
              setViewStage('auth');
            }}
            className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs transition cursor-pointer"
          >
            Se connecter
          </button>

          <button
            type="button"
            id="btn-visitor-gate-dismiss"
            onClick={closeAuthGate}
            className="w-full py-2.5 px-4 rounded-2xl text-white/60 hover:text-white/90 text-xs font-semibold transition cursor-pointer"
          >
            {copy.dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
