export const VISITOR_QUOTAS = {
  dailyLikes: 10,
  dailyFavorites: 5,
  dailyAiQuestions: 5,
} as const;

export const VISITOR_COMMENTS_GATE_MESSAGE =
  'Rejoins DJASSA pour participer à la communauté, commenter les vidéos et échanger avec les autres utilisateurs.';

export const VISITOR_AI_EXHAUSTED_MESSAGE =
  "Tu as utilisé tes questions gratuites du jour. Connecte-toi ou crée un compte DJASSA pour continuer à discuter avec l'assistant IA, profiter de plus d'accès et sauvegarder tes conversations.";

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
