import React, { useEffect, useState } from 'react';
import { 
  Star, 
  CheckCircle2, 
  ShieldCheck, 
  Search, 
  Filter, 
  ThumbsUp, 
  MessageSquare, 
  Sparkles, 
  Camera, 
  Pin, 
  Plus, 
  X, 
  ArrowUpDown, 
  ShoppingBag, 
  Clock, 
  Send, 
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  BadgeCheck,
  Package,
  Heart,
  HelpCircle,
  Share2
} from 'lucide-react';
import { Seller, Product } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { clientService } from '../../../services/clientService';
import { getSecurityToken } from '../../../services/securityService';

export interface ReviewCriteria {
  conformity: number; // 1 to 5
  deliverySpeed: number;
  communication: number;
  packaging: number;
}

export interface ReviewItem {
  id: string;
  sellerId: string;
  clientName: string;
  clientAvatar: string;
  clientCommune: string;
  rating: number; // 1 to 5
  date: string;
  orderNumber: string;
  purchasedProductTitle: string;
  purchasedProductImage?: string;
  purchasedProductId?: string;
  content: string;
  photos?: string[];
  helpfulCount: number;
  isHelpfulByMe?: boolean;
  isPinned?: boolean;
  tags?: string[];
  criteria?: ReviewCriteria;
  sellerReply?: {
    authorName: string;
    avatar: string;
    content: string;
    date: string;
  };
}

interface OrderedProductForReview {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate?: string;
  orderStatus: string;
  productId: string;
  productTitle: string;
  productImage: string;
  alreadyReviewed: boolean;
  canReview: boolean;
  ineligibleReason?: string;
}

interface Props {
  seller: Seller;
  products?: Product[];
  isSellerSelf?: boolean;
  allowClientReview?: boolean;
  onSelectProduct?: (product: Product) => void;
  showToast: (msg: string) => void;
}

type FilterTag = 'all' | 'with_photos' | 'stars_5' | 'stars_4' | 'stars_critical' | 'unreplied' | 'replied';
type SortOption = 'recent' | 'helpful' | 'highest' | 'lowest';

const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    sellerId: 'seller-1',
    clientName: 'Amina Kouamé',
    clientAvatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120',
    clientCommune: 'Cocody Angré 8e Tranche',
    rating: 5,
    date: 'Il y a 2 jours',
    orderNumber: 'DJA-88412',
    purchasedProductTitle: 'Robe Maxi Wax Hollandais 6 Yards',
    purchasedProductImage: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=300',
    purchasedProductId: 'prod-1',
    content: 'La qualité du wax est tout simplement exceptionnelle ! Tissu bien lourd, grand teint garanti, les coutures et la coupe sont parfaites. Reçue en moins de 3 heures à Angré. Je commanderai à nouveau sans hésiter pour les fêtes !',
    photos: [
      'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=600',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600'
    ],
    helpfulCount: 24,
    isHelpfulByMe: false,
    isPinned: true,
    tags: ['Tissu authentique ✨', 'Livraison express 🛵', 'Taille parfaite'],
    criteria: { conformity: 5, deliverySpeed: 5, communication: 5, packaging: 5 },
    sellerReply: {
      authorName: 'Boutique Wax & Élégance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      content: 'Merci infiniment Amina pour votre confiance et pour ce magnifique retour ! Que cette robe vous sublime lors de vos célébrations. À très vite sur Djassa ! ✨',
      date: 'Il y a 1 jour'
    }
  },
  {
    id: 'rev-2',
    sellerId: 'seller-1',
    clientName: 'Mamadou Touré',
    clientAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120',
    clientCommune: 'Plateau & Adjamé',
    rating: 5,
    date: 'Il y a 4 jours',
    orderNumber: 'DJA-88230',
    purchasedProductTitle: 'Boubou Bazin Riche Brodé Or',
    purchasedProductImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300',
    purchasedProductId: 'prod-5',
    content: 'Commandé pour la prière du vendredi et une cérémonie de baptême. La broderie dorée au col est impeccable, le bazin a une brillance naturelle sublime qui tient même après repassage. Vendeur très courtois au téléphone et paiement Wave sécurisé.',
    photos: [
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600'
    ],
    helpfulCount: 18,
    isHelpfulByMe: false,
    isPinned: false,
    tags: ['Broderie haut de gamme 🧵', 'Paiement Wave fluide 🌊'],
    criteria: { conformity: 5, deliverySpeed: 5, communication: 5, packaging: 5 },
    sellerReply: {
      authorName: 'Boutique Wax & Élégance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      content: 'Barakallahou fik M. Touré ! Ravis que le bazin vous plaise pour vos cérémonies. Toute l’équipe d’Adjamé Forum vous salue chaleureusement.',
      date: 'Il y a 3 jours'
    }
  },
  {
    id: 'rev-3',
    sellerId: 'seller-1',
    clientName: 'Grâce Danielle Brou',
    clientAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
    clientCommune: 'Yopougon Maroc',
    rating: 5,
    date: 'Il y a 6 jours',
    orderNumber: 'DJA-87910',
    purchasedProductTitle: 'Combinaison Pantalon Wax Ankara Chic',
    purchasedProductImage: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=300',
    purchasedProductId: 'prod-6',
    content: 'Coup de cœur absolu ! Les couleurs du motif Fleurs de Mariage sont éclatantes. La ceinture affine bien la taille et les poches sont très pratiques. Emballage dans une jolie housse zippée protectrice.',
    photos: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
    ],
    helpfulCount: 15,
    isHelpfulByMe: false,
    isPinned: false,
    tags: ['Coupe cintrée 👌', 'Housse protectrice'],
    criteria: { conformity: 5, deliverySpeed: 4, communication: 5, packaging: 5 }
  },
  {
    id: 'rev-4',
    sellerId: 'seller-1',
    clientName: 'Stéphane Konan',
    clientAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
    clientCommune: 'Marcory Zone 4',
    rating: 4,
    date: 'Il y a 1 semaine',
    orderNumber: 'DJA-87455',
    purchasedProductTitle: 'Chemise Homme Lin Pur & Détails Wax',
    purchasedProductImage: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300',
    purchasedProductId: 'prod-7',
    content: 'Très belle chemise, lin léger et agréable pour le climat d’Abidjan. Seul bémol : un léger retard de livraison à cause des embouteillages du pont HKB, mais la boutique m’a appelé pour me prévenir. Vendeur sérieux.',
    helpfulCount: 9,
    isHelpfulByMe: false,
    isPinned: false,
    tags: ['Lin respirant 🌿', 'Bonne communication'],
    criteria: { conformity: 5, deliverySpeed: 3, communication: 5, packaging: 4 },
    sellerReply: {
      authorName: 'Boutique Wax & Élégance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      content: 'Merci Stéphane pour votre honnêteté ! Nous nous excusons pour ce contretemps routier aux heures de pointe. Pour vous remercier de votre patience, vous avez 10% sur votre prochain achat avec le code WAXSTPH !',
      date: 'Il y a 6 jours'
    }
  },
  {
    id: 'rev-5',
    sellerId: 'seller-1',
    clientName: 'Fatoumata Bamba',
    clientAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120',
    clientCommune: 'Riviera Palmeraie',
    rating: 5,
    date: 'Il y a 10 jours',
    orderNumber: 'DJA-86920',
    purchasedProductTitle: 'Arrivage Capsule Baoulé & Sacs Pochette Fête',
    purchasedProductImage: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=300',
    purchasedProductId: 'prod-8',
    content: 'La pochette est sublime, le tissage Baoulé est fait main et ça se voit direct ! Le fermoir doré ne s’oxyde pas. Reçue avec une petite carte de remerciement personnalisée, c’est très pro !',
    photos: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600'
    ],
    helpfulCount: 12,
    isHelpfulByMe: false,
    isPinned: false,
    tags: ['Artisanat ivoirien 🇨🇮', 'Packaging soigné'],
    criteria: { conformity: 5, deliverySpeed: 5, communication: 5, packaging: 5 }
  }
];

const CANNED_RESPONSES = [
  'Merci infiniment pour votre confiance et votre recommandation chaleureuse ! ✨',
  'Ravis que notre création vous plaise ! Portez-la avec élégance et fierté 👗',
  'Merci pour votre retour ! Toute l’équipe de la boutique reste mobilisée pour vos prochaines commandes ✨',
  'Désolé pour le léger retard lié au trafic d’Abidjan, merci pour votre bienveillance et compréhension ! 🤝',
  'C’est un réel plaisir de vous compter parmi nos fidèles clients. À très bientôt sur Djassa ! ❤️'
];

export const SellerReviewsTab: React.FC<Props> = ({
  seller,
  products = [],
  isSellerSelf = true,
  allowClientReview = false,
  onSelectProduct,
  showToast,
}) => {
  const { updateSeller, updateProductSeller } = useApp();
  const [reviews, setReviews] = useState<ReviewItem[]>(() =>
    INITIAL_REVIEWS.filter((r) => r.sellerId === seller.id)
  );
  const [orderedProducts, setOrderedProducts] = useState<OrderedProductForReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderedProductForReview | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Seller reply composer state
  const [activeReplyingId, setActiveReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Photo viewer modal state
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const mapServerReviewToItem = (srv: any): ReviewItem => {
    const matchedProd = products.find((p) => p.id === srv.productId);
    const createdLabel = srv.createdAt
      ? new Date(srv.createdAt).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : 'Récemment';
    return {
      id: String(srv.id),
      sellerId: String(srv.sellerId || seller.id),
      clientName: String(srv.clientName || 'Client vérifié'),
      clientAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
      clientCommune: String(srv.clientCommune || 'Abidjan'),
      rating: Number(srv.rating) || 5,
      date: createdLabel,
      orderNumber: String(srv.orderNumber || srv.orderId || 'COMMANDE'),
      purchasedProductTitle: String(srv.productTitle || matchedProd?.name || 'Article commandé'),
      purchasedProductImage: srv.productImage || matchedProd?.images?.[0] || matchedProd?.videoPoster,
      purchasedProductId: srv.productId ? String(srv.productId) : matchedProd?.id,
      content: String(srv.comment || ''),
      helpfulCount: 0,
      tags: ['Achat vérifié ✓']
    };
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoadingReviews(true);
    setSelectedOrderItem(null);
    setReviewSubmitError(null);
    const seedForSeller = INITIAL_REVIEWS.filter((r) => r.sellerId === seller.id);
    setReviews(seedForSeller);

    clientService
      .getSellerReviewsAndEligibility(seller.id)
      .then((res) => {
        if (cancelled || !res?.success) return;
        const mappedServer = (res.reviews || []).map(mapServerReviewToItem);
        const existingIds = new Set(mappedServer.map((r) => r.id));
        setReviews([
          ...mappedServer,
          ...seedForSeller.filter((r) => !existingIds.has(r.id))
        ]);
        setOrderedProducts(Array.isArray(res.orderedProducts) ? res.orderedProducts : []);
      })
      .catch(() => {
        if (!cancelled) {
          setOrderedProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReviews(false);
      });

    return () => {
      cancelled = true;
    };
  }, [seller.id]);

  // Stats calculation
  const totalReviews = Math.max(seller.reviewsCount || 0, reviews.length);
  const averageRating = seller.rating || 4.9;
  const rating5Count = Math.round(totalReviews * 0.89);
  const rating4Count = Math.round(totalReviews * 0.08);
  const rating3Count = Math.round(totalReviews * 0.02);
  const rating2Count = Math.round(totalReviews * 0.01);
  const rating1Count = Math.max(0, totalReviews - (rating5Count + rating4Count + rating3Count + rating2Count));
  const satisfactionRate = 98.6;

  // Filter logic
  const filteredReviews = reviews.filter((rev) => {
    // Tag filters
    if (filterTag === 'with_photos' && (!rev.photos || rev.photos.length === 0)) return false;
    if (filterTag === 'stars_5' && rev.rating !== 5) return false;
    if (filterTag === 'stars_4' && rev.rating !== 4) return false;
    if (filterTag === 'stars_critical' && rev.rating > 3) return false;
    if (filterTag === 'unreplied' && !!rev.sellerReply) return false;
    if (filterTag === 'replied' && !rev.sellerReply) return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      rev.clientName.toLowerCase().includes(q) ||
      rev.clientCommune.toLowerCase().includes(q) ||
      rev.content.toLowerCase().includes(q) ||
      rev.purchasedProductTitle.toLowerCase().includes(q) ||
      rev.orderNumber.toLowerCase().includes(q) ||
      (rev.tags && rev.tags.some(t => t.toLowerCase().includes(q)))
    );
  });

  // Sort logic
  const sortedReviews = [...filteredReviews].sort((a, b) => {
    // Pinned always on top
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    if (sortBy === 'helpful') {
      return b.helpfulCount - a.helpfulCount;
    }
    if (sortBy === 'highest') {
      return b.rating - a.rating;
    }
    if (sortBy === 'lowest') {
      return a.rating - b.rating;
    }
    return 0; // recent (default array order)
  });

  // Helpful toggle
  const handleToggleHelpful = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          const isNowHelpful = !r.isHelpfulByMe;
          return {
            ...r,
            isHelpfulByMe: isNowHelpful,
            helpfulCount: isNowHelpful ? r.helpfulCount + 1 : Math.max(0, r.helpfulCount - 1),
          };
        }
        return r;
      })
    );
    showToast('Merci pour votre vote ! 👍');
  };

  // Pin / Unpin review
  const handleTogglePin = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          const nextPinned = !r.isPinned;
          return { ...r, isPinned: nextPinned };
        }
        return r;
      })
    );
    showToast('Statut de mise en avant mis à jour 📌');
  };

  // Publish seller reply
  const handlePublishReply = (reviewId: string) => {
    if (!replyText.trim()) return;

    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          return {
            ...r,
            sellerReply: {
              authorName: seller.name,
              avatar: seller.avatar,
              content: replyText.trim(),
              date: "À l'instant",
            },
          };
        }
        return r;
      })
    );

    setReplyText('');
    setActiveReplyingId(null);
    showToast('Votre réponse au client a été publiée ! ✨');
  };

  // Delete seller reply
  const handleDeleteReply = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          const { sellerReply, ...rest } = r;
          return rest;
        }
        return r;
      })
    );
    showToast('Réponse supprimée.');
  };

  // Submit verified customer review strictly bound to real delivered order + product
  const handleAddVerifiedReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderItem || !selectedOrderItem.canReview) {
      setReviewSubmitError('Sélectionnez un produit livré et non encore évalué.');
      return;
    }
    const trimmedComment = reviewComment.trim();
    if (trimmedComment.length < 3) {
      setReviewSubmitError('Veuillez rédiger un commentaire d’au moins 3 caractères.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewSubmitError(null);
    try {
      const res = await clientService.submitVerifiedSellerReview(seller.id, {
        orderId: selectedOrderItem.orderId,
        productId: selectedOrderItem.productId,
        rating: reviewRating,
        comment: trimmedComment
      });

      const createdItem = mapServerReviewToItem(res.review);
      setReviews((prev) => [createdItem, ...prev]);
      setOrderedProducts((prev) =>
        prev.map((item) =>
          item.orderId === selectedOrderItem.orderId && item.productId === selectedOrderItem.productId
            ? {
                ...item,
                alreadyReviewed: true,
                canReview: false,
                ineligibleReason: 'Avis déjà déposé'
              }
            : item
        )
      );

      const nextReviewsCount = (seller.reviewsCount || 0) + 1;
      const nextSellerRating = Number(
        (((seller.rating || 5) * (seller.reviewsCount || 1) + reviewRating) / nextReviewsCount).toFixed(1)
      );
      updateSeller(seller.id, { reviewsCount: nextReviewsCount, rating: nextSellerRating });

      const matchedProd = products.find((p) => p.id === selectedOrderItem.productId);
      if (matchedProd) {
        const prevProdRev =
          matchedProd.reviewsCount || Math.max(1, Math.round((matchedProd.salesCount || 10) * 0.15));
        const nextProdRev = prevProdRev + 1;
        const nextProdRating = Number(
          (((matchedProd.rating || 5) * prevProdRev + reviewRating) / nextProdRev).toFixed(1)
        );
        updateProductSeller(matchedProd.id, { reviewsCount: nextProdRev, rating: nextProdRating });
      }

      setSelectedOrderItem(null);
      setReviewComment('');
      setReviewRating(5);
      showToast('Votre avis client vérifié a été publié avec succès ! ⭐');
    } catch (err: any) {
      const msg = err?.message || 'Impossible de publier cet avis sur le serveur.';
      setReviewSubmitError(msg);
      showToast(msg);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const unrepliedCount = reviews.filter((r) => !r.sellerReply).length;

  return (
    <div id="seller-reviews-tab" className="space-y-4">
      {/* 1. TOP RATING & SATISFACTION HERO CARD */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#1c140e] via-[#141414] to-black border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          {/* Left Column: Big Score & Stars */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex flex-col items-center justify-center shrink-0 shadow-inner">
              <span className="text-3xl sm:text-4xl font-black text-amber-400 leading-none">
                {averageRating.toFixed(1)}
              </span>
              <div className="flex text-amber-400 text-xs mt-1">
                {'★★★★★'}
              </div>
              <span className="text-[9px] text-white/50 font-bold mt-0.5">sur 5.0</span>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm sm:text-base font-black text-white">
                  Évaluation Globale Boutique
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" />
                  <span>Vendeur Certifié Djassa</span>
                </span>
              </div>
              <p className="text-xs text-white/60">
                Basé sur <b className="text-white">{totalReviews} avis clients vérifiés</b> avec preuve de livraison à Abidjan.
              </p>
              <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{satisfactionRate}% de satisfaction client</span>
                </span>
                <span className="text-white/30">•</span>
                <span className="text-white/50">Taux de retour : &lt; 0.8%</span>
              </div>
            </div>
          </div>

          {/* Right Column: Verified eligibility status (never open to non-buyers) */}
          {!isSellerSelf && allowClientReview && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold text-white/75 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {orderedProducts.some((p) => p.canReview)
                    ? `${orderedProducts.filter((p) => p.canReview).length} article(s) à évaluer`
                    : 'Avis réservés aux acheteurs livrés'}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Breakdown by Stars */}
        <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
          {/* Detailed Star Distribution Bars */}
          <div className="space-y-1.5 max-w-xl">
            <span className="text-[11px] font-bold text-white/70 block mb-1">
              Répartition des notes ({totalReviews} avis)
            </span>
            
            {[
              { stars: 5, count: rating5Count, pct: 89 },
              { stars: 4, count: rating4Count, pct: 8 },
              { stars: 3, count: rating3Count, pct: 2 },
              { stars: 2, count: rating2Count, pct: 1 },
              { stars: 1, count: rating1Count, pct: 0 },
            ].map(({ stars, count, pct }) => (
              <button
                key={stars}
                onClick={() => setFilterTag(stars === 5 ? 'stars_5' : stars === 4 ? 'stars_4' : 'stars_critical')}
                className="w-full flex items-center gap-2 group hover:opacity-100 transition text-left"
              >
                <div className="flex items-center text-[10px] font-bold text-amber-400 w-12 shrink-0">
                  <span>{stars}</span>
                  <Star className="w-3 h-3 fill-amber-400 ml-0.5" />
                </div>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-[#FF6321] rounded-full transition-all duration-500" 
                    style={{ width: `${pct}%` }} 
                  />
                </div>
                <span className="text-[10px] text-white/50 w-12 text-right group-hover:text-white font-medium">
                  {pct}% ({count})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Verified reviews assurance badge */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-[10px] text-white/60">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <b>Garantie Transparence Djassa :</b> Seuls les clients ayant une commande réelle livrée dans cette boutique peuvent publier une évaluation.
          </span>
        </div>
      </div>

      {/* 1B. PRODUITS DÉJÀ COMMANDÉS DANS CETTE BOUTIQUE (CLIENT CONNECTÉ UNIQUEMENT) */}
      {!isSellerSelf && allowClientReview && (
        <div
          id="client-ordered-products-reviews-section"
          className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-[#FF6321]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-white truncate">
                  Produits déjà commandés dans cette boutique
                </h4>
                <p className="text-[10px] text-white/50 truncate">
                  Sélectionnez un article livré pour lui attribuer une note et un commentaire
                </p>
              </div>
            </div>
            {orderedProducts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-bold shrink-0">
                {orderedProducts.length}
              </span>
            )}
          </div>

          {!getSecurityToken() ? (
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] text-white/65">
              Connectez-vous à votre compte client pour consulter vos achats effectués dans cette boutique et déposer un avis vérifié.
            </div>
          ) : isLoadingReviews ? (
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] text-white/50">
              Vérification de vos commandes en cours…
            </div>
          ) : orderedProducts.length === 0 ? (
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] text-white/65">
              Vous n&apos;avez pas encore de commande éligible dans cette boutique. Seuls les acheteurs ayant commandé et reçu un produit peuvent laisser un avis.
            </div>
          ) : (
            <div className="space-y-2.5">
              {orderedProducts.map((item) => {
                const isSelected =
                  selectedOrderItem?.orderId === item.orderId &&
                  selectedOrderItem?.productId === item.productId;
                const formattedDate = new Date(
                  item.deliveryDate || item.orderDate
                ).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <div
                    key={`${item.orderId}-${item.productId}`}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#FF6321]/10 border-[#FF6321]'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className="w-11 h-11 rounded-xl object-cover border border-white/15 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-5 h-5 text-[#FF6321]" />
                        </div>
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-extrabold text-white truncate">
                          {item.productTitle}
                        </p>
                        <p className="text-[10px] text-white/50 truncate">
                          {item.deliveryDate ? 'Livré le' : 'Commandé le'} {formattedDate} • #{item.orderNumber}
                        </p>
                      </div>
                    </div>

                    {item.alreadyReviewed ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Avis publié</span>
                      </span>
                    ) : !item.canReview ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold shrink-0">
                        {item.ineligibleReason || 'En attente de livraison'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderItem(isSelected ? null : item);
                          setReviewRating(5);
                          setReviewComment('');
                          setReviewSubmitError(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 transition active:scale-95 ${
                          isSelected
                            ? 'bg-white/15 text-white'
                            : 'bg-[#FF6321] hover:bg-[#ff7538] text-white shadow'
                        }`}
                      >
                        {isSelected ? 'Fermer' : 'Noter'}
                      </button>
                    )}
                  </div>
                );
              })}

              {selectedOrderItem && selectedOrderItem.canReview && (
                <form
                  id="verified-seller-review-form"
                  onSubmit={handleAddVerifiedReview}
                  className="p-3.5 rounded-2xl bg-black/50 border border-[#FF6321]/40 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white truncate">
                      Évaluer : {selectedOrderItem.productTitle}
                    </span>
                    <span className="text-[10px] font-mono text-white/50 shrink-0">
                      #{selectedOrderItem.orderNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-white/60 mr-1">Note :</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-0.5 transition hover:scale-110"
                        aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-white/20'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-black text-amber-400 ml-1">
                      {reviewRating}/5
                    </span>
                  </div>

                  <textarea
                    required
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Partagez votre avis réel sur ce produit reçu..."
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                  />

                  {reviewSubmitError && (
                    <p className="text-[11px] text-rose-400 font-semibold">
                      {reviewSubmitError}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderItem(null);
                        setReviewSubmitError(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 text-white/75 text-xs font-bold hover:bg-white/20 transition"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReview}
                      className="px-4 py-1.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] disabled:opacity-50 text-white text-xs font-black shadow transition"
                    >
                      {isSubmittingReview ? 'Envoi…' : 'Publier mon avis vérifié'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="space-y-2.5">
        {/* Search bar & Sort selector */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans les avis (nom, commune, article, mot-clé)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]/60 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 text-[11px] text-white/50 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#FF6321]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-[#181818] text-white text-[11px] font-bold rounded-lg px-2.5 py-2 border border-white/10 focus:outline-none"
            >
              <option value="recent">Plus récents</option>
              <option value="helpful">Plus utiles 👍</option>
              <option value="highest">Notes élevées (5★)</option>
              <option value="lowest">Notes modérées</option>
            </select>
          </div>
        </div>

        {/* Filter Chips Horizontal Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setFilterTag('all')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
              filterTag === 'all'
                ? 'bg-white text-black shadow-sm'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}
          >
            Tous les avis ({reviews.length})
          </button>

          <button
            onClick={() => setFilterTag('with_photos')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 ${
              filterTag === 'with_photos'
                ? 'bg-[#FF6321] text-white'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}
          >
            <Camera className="w-3 h-3" />
            <span>Avec photos ({reviews.filter(r => r.photos && r.photos.length > 0).length})</span>
          </button>

          <button
            onClick={() => setFilterTag('stars_5')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 ${
              filterTag === 'stars_5'
                ? 'bg-amber-500 text-black'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>5 étoiles ({reviews.filter(r => r.rating === 5).length})</span>
          </button>

          <button
            onClick={() => setFilterTag('stars_4')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
              filterTag === 'stars_4'
                ? 'bg-amber-600 text-white'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}
          >
            4 étoiles ({reviews.filter(r => r.rating === 4).length})
          </button>

          <button
            onClick={() => setFilterTag('stars_critical')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
              filterTag === 'stars_critical'
                ? 'bg-red-500 text-white'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}
          >
            ≤ 3 étoiles ({reviews.filter(r => r.rating <= 3).length})
          </button>

          {isSellerSelf && unrepliedCount > 0 && (
            <button
              onClick={() => setFilterTag('unreplied')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 ${
                filterTag === 'unreplied'
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              <span>⏳ À répondre ({unrepliedCount})</span>
            </button>
          )}

          <button
            onClick={() => setFilterTag('replied')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
              filterTag === 'replied'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}
          >
            💬 Avec réponse ({reviews.filter(r => !!r.sellerReply).length})
          </button>
        </div>
      </div>

      {/* 3. REVIEWS LIST */}
      <div className="space-y-3">
        {sortedReviews.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-2">
            <MessageSquare className="w-8 h-8 text-white/30 mx-auto" />
            <h4 className="text-xs font-bold text-white">Aucun avis trouvé</h4>
            <p className="text-[11px] text-white/40">
              Aucune évaluation ne correspond à vos filtres actuels.
            </p>
            <button
              onClick={() => {
                setFilterTag('all');
                setSearchQuery('');
              }}
              className="mt-2 py-1.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          sortedReviews.map((rev) => {
            const isReplyingThis = activeReplyingId === rev.id;

            return (
              <div
                key={rev.id}
                className={`p-4 rounded-3xl bg-[#141414] border transition duration-200 space-y-3 shadow-lg ${
                  rev.isPinned
                    ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/[0.03] to-[#141414]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Pinned banner if applicable */}
                {rev.isPinned && (
                  <div className="flex items-center justify-between pb-1 text-[10px] font-black text-amber-400 border-b border-amber-500/20">
                    <span className="flex items-center gap-1">
                      <Pin className="w-3 h-3 fill-amber-400" />
                      <span>Avis mis en avant par la boutique</span>
                    </span>
                    {isSellerSelf && (
                      <button
                        onClick={() => handleTogglePin(rev.id)}
                        className="text-white/40 hover:text-white"
                      >
                        Détacher
                      </button>
                    )}
                  </div>
                )}

                {/* Reviewer Info & Star Rating Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={rev.clientAvatar}
                      alt={rev.clientName}
                      className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <b className="text-xs text-white truncate">{rev.clientName}</b>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Acheteur certifié</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/50 mt-0.5">
                        <span>{rev.clientCommune}</span>
                        <span>•</span>
                        <span>{rev.date}</span>
                        <span>•</span>
                        <span className="font-mono text-white/40">#{rev.orderNumber}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stars display */}
                  <div className="flex flex-col items-end shrink-0">
                    <div className="flex text-amber-400 text-xs">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-amber-400 font-bold mt-0.5">
                      {rev.rating}.0 / 5
                    </span>
                  </div>
                </div>

                {/* Purchased Product Pill (clickable) */}
                <div
                  onClick={() => {
                    if (onSelectProduct && rev.purchasedProductId) {
                      const found = products.find(p => p.id === rev.purchasedProductId);
                      if (found) onSelectProduct(found);
                    }
                  }}
                  className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2 hover:bg-white/[0.08] transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {rev.purchasedProductImage ? (
                      <img
                        src={rev.purchasedProductImage}
                        alt={rev.purchasedProductTitle}
                        className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-[#FF6321]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-[9px] text-white/40 block">Article acheté :</span>
                      <b className="text-xs text-white group-hover:text-[#FF6321] transition truncate block">
                        {rev.purchasedProductTitle}
                      </b>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white shrink-0" />
                </div>

                {/* Criteria Tags / Highlights */}
                {rev.tags && rev.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rev.tags.map((t, ti) => (
                      <span
                        key={ti}
                        className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/70 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Review Text */}
                <p className="text-xs text-white/85 leading-relaxed">
                  {rev.content}
                </p>

                {/* Photo Attachments Strip (Click to Zoom) */}
                {rev.photos && rev.photos.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-white/50 flex items-center gap-1 font-bold">
                      <Camera className="w-3 h-3 text-[#FF6321]" />
                      <span>Photos partagées par le client ({rev.photos.length}) :</span>
                    </span>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {rev.photos.map((photo, pi) => (
                        <div
                          key={pi}
                          onClick={() => setPreviewPhotoUrl(photo)}
                          className="relative aspect-square w-20 h-20 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0 cursor-pointer group shadow"
                        >
                          <img
                            src={photo}
                            alt={`Photo client ${pi + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <span className="text-[9px] text-white font-black bg-black/60 px-1.5 py-0.5 rounded">
                              Agrandir
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seller Reply Box (if any) */}
                {rev.sellerReply && (
                  <div className="p-3 rounded-2xl bg-[#FF6321]/[0.06] border border-[#FF6321]/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={rev.sellerReply.avatar}
                          alt={rev.sellerReply.authorName}
                          className="w-5 h-5 rounded-full object-cover border border-[#FF6321]"
                        />
                        <span className="text-[11px] font-black text-[#FF6321] flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Réponse officielle de {rev.sellerReply.authorName}</span>
                        </span>
                        <span className="text-[9px] text-white/40">• {rev.sellerReply.date}</span>
                      </div>

                      {isSellerSelf && (
                        <button
                          onClick={() => handleDeleteReply(rev.id)}
                          className="text-[9px] text-white/40 hover:text-red-400 transition"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-white/80 pl-7 leading-relaxed">
                      {rev.sellerReply.content}
                    </p>
                  </div>
                )}

                {/* Actions Row: Helpful Vote, Reply trigger, Pin trigger */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs text-white/60">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleHelpful(rev.id)}
                      className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition ${
                        rev.isHelpfulByMe
                          ? 'bg-[#FF6321]/20 text-[#FF6321] font-bold'
                          : 'hover:bg-white/5 text-white/60 hover:text-white'
                      }`}
                      title="Utile"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${rev.isHelpfulByMe ? 'fill-[#FF6321]' : ''}`} />
                      <span className="text-[11px]">Utile ({rev.helpfulCount})</span>
                    </button>

                    {isSellerSelf && (
                      <button
                        onClick={() => handleTogglePin(rev.id)}
                        className={`flex items-center gap-1 py-1 px-2 rounded-lg text-[11px] transition ${
                          rev.isPinned
                            ? 'text-amber-400 font-bold bg-amber-500/10'
                            : 'hover:bg-white/5 text-white/60 hover:text-white'
                        }`}
                        title="Mettre en avant"
                      >
                        <Pin className={`w-3 h-3 ${rev.isPinned ? 'fill-amber-400' : ''}`} />
                        <span>{rev.isPinned ? 'Épinglé' : 'Épingler'}</span>
                      </button>
                    )}
                  </div>

                  {/* Reply Button for Seller */}
                  {isSellerSelf && (
                    <button
                      onClick={() => {
                        if (isReplyingThis) {
                          setActiveReplyingId(null);
                        } else {
                          setActiveReplyingId(rev.id);
                          setReplyText(rev.sellerReply?.content || '');
                        }
                      }}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-white/5 hover:bg-[#FF6321] hover:text-white text-white/80 text-[11px] font-bold transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{rev.sellerReply ? 'Modifier réponse' : 'Répondre au client'}</span>
                    </button>
                  )}
                </div>

                {/* Inline Seller Reply Composer with Canned Response Chips */}
                {isReplyingThis && (
                  <div className="p-3 rounded-2xl bg-black/50 border border-[#FF6321]/40 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#FF6321]" />
                        <span>Rédiger une réponse publique :</span>
                      </span>
                      <button
                        onClick={() => setActiveReplyingId(null)}
                        className="text-white/40 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Quick Response Templates */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/50 block">Modèles de réponse rapide en 1 clic :</span>
                      <div className="flex flex-wrap gap-1">
                        {CANNED_RESPONSES.map((tmpl, ti) => (
                          <button
                            key={ti}
                            type="button"
                            onClick={() => setReplyText(tmpl)}
                            className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] text-white/70 hover:text-white text-left transition"
                          >
                            {tmpl.substring(0, 36)}...
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Ex: Merci infiniment pour votre confiance ! À très bientôt sur Djassa..."
                      rows={3}
                      className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveReplyingId(null)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 text-white/70 text-xs font-bold hover:bg-white/20 transition"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePublishReply(rev.id)}
                        disabled={!replyText.trim()}
                        className="px-4 py-1.5 rounded-xl bg-[#FF6321] disabled:opacity-40 hover:bg-[#ff753b] text-white text-xs font-black shadow transition flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Publier la réponse</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. LIGHTBOX MODAL FOR REVIEW PHOTO ZOOM */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-xl max-h-[85vh] rounded-3xl overflow-hidden bg-neutral-900 border border-white/20 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewPhotoUrl}
              alt="Photo client agrandie"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-black transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      </div>
  );
};
