import { countWords, enforceMaxWordsReply, GPT_CLIENT_MAX_WORDS } from '../src/services/aiWordLimit.ts';

export type RodiumModelId =
  | 'minimax-m3.1-flash'
  | 'qwen-image-2.1-turbo'
  | 'minimax-h3-max-turbo'
  | 'minimax-h3';

export interface RodiumAuthorizedModelInfo {
  id: RodiumModelId;
  displayName: string;
  responsibility: 'assistance_analyse' | 'generation_images' | 'conversations_assistance';
  description: string;
}

export const RODIUM_AUTHORIZED_MODELS: Record<RodiumModelId, RodiumAuthorizedModelInfo> = {
  'minimax-m3.1-flash': {
    id: 'minimax-m3.1-flash',
    displayName: 'MiniMax M3.1 Flash',
    responsibility: 'assistance_analyse',
    description: 'Assistance rapide et analyse (recommandations catalogue, fiches produits, synthèse).'
  },
  'qwen-image-2.1-turbo': {
    id: 'qwen-image-2.1-turbo',
    displayName: 'Qwen Image 2.1 Turbo',
    responsibility: 'generation_images',
    description: 'Génération et essayage virtuel d’images e-commerce haute qualité.'
  },
  'minimax-h3-max-turbo': {
    id: 'minimax-h3-max-turbo',
    displayName: 'MiniMax H3 Max Turbo',
    responsibility: 'conversations_assistance',
    description: 'Conversations et assistance avancée (négociation, vendeur, dispatch).'
  },
  'minimax-h3': {
    id: 'minimax-h3',
    displayName: 'MiniMax H3',
    responsibility: 'conversations_assistance',
    description: 'Conversations et assistance générale sur DJASSA.'
  }
};

const DEFAULT_RODIUMAI_BASE_URL = 'https://api.rodiumai.io/v1';

export function getRodiumAiConfig() {
  const apiKey = (process.env.RODIUMAI_API_KEY || '').trim();
  const baseUrl = (process.env.RODIUMAI_BASE_URL || DEFAULT_RODIUMAI_BASE_URL).trim().replace(/\/+$/, '');
  return {
    configured: apiKey.length > 0,
    apiKey,
    baseUrl,
    models: {
      flash: (process.env.RODIUMAI_MODEL_FLASH || 'minimax-m3.1-flash').trim() as RodiumModelId,
      image: (process.env.RODIUMAI_MODEL_IMAGE || 'qwen-image-2.1-turbo').trim() as RodiumModelId,
      maxTurbo: (process.env.RODIUMAI_MODEL_MAX_TURBO || 'minimax-h3-max-turbo').trim() as RodiumModelId,
      standard: (process.env.RODIUMAI_MODEL_STANDARD || 'minimax-h3').trim() as RodiumModelId
    }
  };
}

/**
 * Résout strictement vers l'un des 4 modèles RodiumAI autorisés.
 * Bloque explicitement tout modèle interdit (ex: Qwen Image 2.1 Pro, Gemini, GPT-4o, Kling).
 */
export function resolveAuthorizedRodiumModel(
  requested?: string,
  fallback: RodiumModelId = 'minimax-m3.1-flash'
): RodiumModelId {
  const clean = String(requested || '').trim().toLowerCase();
  if (!clean) return fallback;
  if (clean === 'minimax-m3.1-flash' || clean === 'minimax m3.1 flash') return 'minimax-m3.1-flash';
  if (clean === 'qwen-image-2.1-turbo' || clean === 'qwen image 2.1 turbo') return 'qwen-image-2.1-turbo';
  if (clean === 'minimax-h3-max-turbo' || clean === 'minimax h3 max turbo') return 'minimax-h3-max-turbo';
  if (clean === 'minimax-h3' || clean === 'minimax h3') return 'minimax-h3';
  return fallback;
}

export async function callRodiumChat(input: {
  prompt: string;
  systemInstruction?: string;
  images?: string[];
  model?: string;
  enforceWordLimit?: boolean;
}): Promise<{
  ok: boolean;
  configured: boolean;
  text?: string;
  wordCount?: number;
  maxWords?: number;
  model: RodiumModelId;
  error?: string;
  message?: string;
}> {
  const cfg = getRodiumAiConfig();
  const model = resolveAuthorizedRodiumModel(input.model, 'minimax-m3.1-flash');
  if (model === 'qwen-image-2.1-turbo') {
    return {
      ok: false,
      configured: cfg.configured,
      model: 'minimax-m3.1-flash',
      error: 'MODEL_ROLE_MISMATCH',
      message: 'Qwen Image 2.1 Turbo est réservé à la génération d’images.'
    };
  }

  if (!cfg.configured) {
    return {
      ok: false,
      configured: false,
      model,
      error: 'RODIUMAI_NOT_CONFIGURED',
      message: 'Le fournisseur IA RodiumAI n’est pas configuré sur le serveur (RODIUMAI_API_KEY).'
    };
  }

  const enforceLimit = input.enforceWordLimit !== false;
  const strictWordLimitInstruction = enforceLimit
    ? `RÈGLE STRICTE : Réponds en français de manière directe, utile et claire en MAXIMUM ${GPT_CLIENT_MAX_WORDS} mots (jamais plus de 30 mots). Pas de répétitions ni de phrases inutiles.`
    : '';
  const mergedSystemInstruction = [strictWordLimitInstruction, input.systemInstruction || '']
    .filter(Boolean)
    .join('\n\n');

  const userContent: Array<Record<string, unknown>> = [];
  if (input.prompt) {
    userContent.push({ type: 'text', text: input.prompt });
  } else {
    userContent.push({ type: 'text', text: 'Analyse ces images et recommande des produits correspondants.' });
  }
  for (const img of (input.images || []).slice(0, 3)) {
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      userContent.push({ type: 'image_url', image_url: { url: img } });
    }
  }

  try {
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [
          ...(mergedSystemInstruction ? [{ role: 'system', content: mergedSystemInstruction }] : []),
          { role: 'user', content: userContent.length === 1 && !input.images?.length ? input.prompt : userContent }
        ]
      }),
      signal: AbortSignal.timeout(30_000)
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        model,
        error: 'RODIUMAI_CALL_FAILED',
        message: String(data?.error?.message || data?.message || `Erreur RodiumAI HTTP ${response.status}`)
      };
    }

    const rawText = String(
      data?.choices?.[0]?.message?.content ??
        data?.output_text ??
        data?.text ??
        ''
    ).trim();

    const finalText = enforceLimit ? enforceMaxWordsReply(rawText, GPT_CLIENT_MAX_WORDS) : rawText;
    return {
      ok: true,
      configured: true,
      text: finalText,
      wordCount: countWords(finalText),
      maxWords: GPT_CLIENT_MAX_WORDS,
      model
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      model,
      error: 'RODIUMAI_CALL_FAILED',
      message: (err as Error).message || 'Erreur réseau lors de la requête RodiumAI.'
    };
  }
}

export async function callRodiumImageGeneration(input: {
  userPhoto: string;
  productImage: string;
  productName: string;
  productCategory: string;
  modelName?: string;
  modelGender?: 'female' | 'male';
  morphology?: string;
  morphologyDetail?: string;
  size?: string;
  color?: string;
  viewAngle?: string;
  drapeFitNotes?: string;
}): Promise<{
  ok: boolean;
  configured: boolean;
  imageDataUrl?: string;
  model: 'qwen-image-2.1-turbo';
  error?: string;
  message?: string;
}> {
  const cfg = getRodiumAiConfig();
  const model: 'qwen-image-2.1-turbo' = 'qwen-image-2.1-turbo';
  if (!cfg.configured) {
    return {
      ok: false,
      configured: false,
      model,
      error: 'RODIUMAI_NOT_CONFIGURED',
      message: 'Génération image RodiumAI (Qwen Image 2.1 Turbo) indisponible : clé RODIUMAI_API_KEY absente côté serveur.'
    };
  }

  const morphologyParts = [
    input.modelGender ? (input.modelGender === 'female' ? 'Femme' : 'Homme') : null,
    input.modelName ? `Mannequin ${input.modelName}` : null,
    input.morphology ? `Morphologie ${input.morphology}` : null,
    input.morphologyDetail ? `(${input.morphologyDetail})` : null,
    input.size ? `Taille ${input.size}` : null,
    input.color ? `Couleur/variante ${input.color}` : null,
    input.viewAngle ? `Vue ${input.viewAngle}` : null,
    input.drapeFitNotes ? `Tombé attendu : ${input.drapeFitNotes}` : null
  ]
    .filter(Boolean)
    .join(' • ');

  const tryOnPrompt = [
    `Génère une photo réaliste d'essayage virtuel en pied (de la tête aux pieds, sans recadrage) montrant fidèlement la personne et sa morphologie exacte de la première photo portant l'article "${input.productName}" (${input.productCategory}) visible sur la seconde image.`,
    morphologyParts ? `Paramètres morphologiques et style à respecter strictement : ${morphologyParts}.` : '',
    `Conserve exactement la corpulence, les proportions corporelles, le visage et la posture de la première image tout en habillant le modèle avec la tenue exacte de la seconde image, avec un tombé de tissu naturel et réaliste. Style e-commerce studio haute qualité.`
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const response = await fetch(`${cfg.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt: tryOnPrompt,
        reference_images: [input.userPhoto, input.productImage],
        metadata: {
          ...(input.modelName ? { modelName: input.modelName } : {}),
          ...(input.modelGender ? { modelGender: input.modelGender } : {}),
          ...(input.morphology ? { morphology: input.morphology } : {}),
          ...(input.size ? { size: input.size } : {}),
          ...(input.color ? { color: input.color } : {}),
          ...(input.viewAngle ? { viewAngle: input.viewAngle } : {})
        },
        response_format: 'b64_json'
      }),
      signal: AbortSignal.timeout(40_000)
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        model,
        error: 'TRY_ON_PROVIDER_ERROR',
        message: String(data?.error?.message || data?.message || `Erreur RodiumAI Image HTTP ${response.status}`)
      };
    }

    const b64 = data?.data?.[0]?.b64_json || data?.imageBase64;
    const url = data?.data?.[0]?.url || data?.imageUrl;
    const imageDataUrl = b64 ? `data:image/png;base64,${b64}` : typeof url === 'string' && url ? url : undefined;

    if (!imageDataUrl) {
      return {
        ok: false,
        configured: true,
        model,
        error: 'TRY_ON_GENERATION_EMPTY',
        message: 'Le modèle Qwen Image 2.1 Turbo n’a retourné aucun visuel généré. Aucun crédit débité.'
      };
    }

    return { ok: true, configured: true, imageDataUrl, model };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      model,
      error: 'TRY_ON_PROVIDER_ERROR',
      message: (err as Error).message || 'Erreur lors de la génération image RodiumAI.'
    };
  }
}

export async function callRodiumVideoGeneration(input: {
  prompt?: string;
  mode?: 'text' | 'image';
  sourceImage?: string;
}): Promise<{
  ok: boolean;
  configured: boolean;
  taskId: string | null;
  videoUrl: string | null;
  raw?: unknown;
  error?: string;
  message?: string;
}> {
  const cfg = getRodiumAiConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      configured: false,
      taskId: null,
      videoUrl: null,
      error: 'RODIUMAI_NOT_CONFIGURED',
      message: 'Génération vidéo RodiumAI indisponible : clé RODIUMAI_API_KEY non configurée côté serveur.'
    };
  }

  try {
    const response = await fetch(`${cfg.baseUrl}/videos/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-image-2.1-turbo',
        mode: input.mode === 'image' && input.sourceImage ? 'image2video' : 'text2video',
        prompt: String(input.prompt || ''),
        ...(input.mode === 'image' && input.sourceImage ? { image: String(input.sourceImage) } : {}),
        duration: 5
      }),
      signal: AbortSignal.timeout(40_000)
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        taskId: null,
        videoUrl: null,
        error: 'RODIUMAI_VIDEO_ERROR',
        message: String(data?.error?.message || data?.message || 'Erreur fournisseur RodiumAI. Aucun crédit débité.')
      };
    }

    return {
      ok: true,
      configured: true,
      taskId: data?.data?.task_id || data?.task_id || data?.id || null,
      videoUrl: data?.data?.video_url || data?.video_url || null,
      raw: data
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      taskId: null,
      videoUrl: null,
      error: 'RODIUMAI_NETWORK_ERROR',
      message: (err as Error).message || 'Impossible de joindre RodiumAI.'
    };
  }
}

export async function probeRodiumAiHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  status: number;
  ms: number;
  error: string | null;
}> {
  const cfg = getRodiumAiConfig();
  if (!cfg.configured) {
    return { configured: false, ok: false, status: 0, ms: 0, error: 'RODIUMAI_API_KEY absente sur le serveur' };
  }
  const start = Date.now();
  try {
    const res = await fetch(`${cfg.baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(3000)
    });
    return {
      configured: true,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - start,
      error: res.ok ? null : `Réponse fournisseur RodiumAI HTTP ${res.status}`
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      status: 0,
      ms: Date.now() - start,
      error: (err as Error).message || 'Fournisseur RodiumAI injoignable'
    };
  }
}
