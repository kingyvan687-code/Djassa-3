import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  HelpCircle,
  Truck,
  CreditCard,
  RefreshCw,
  PhoneCall,
  Package,
  MessageCircle,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface HelpCenterSettingsScreenProps {
  onBack: () => void;
  onNavigateToMessages?: () => void;
}

export const HelpCenterSettingsScreen: React.FC<HelpCenterSettingsScreenProps> = ({
  onBack,
  onNavigateToMessages,
}) => {
  const { openSupportChat } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const categories = [
    { id: 'all', title: 'Toutes les rubriques', icon: HelpCircle },
    { id: 'delivery', title: 'Livraison Vendeur', icon: Truck },
    { id: 'payment', title: 'Paiements Mobiles', icon: CreditCard },
    { id: 'guarantee', title: 'Garanties & Retours', icon: RefreshCw },
    { id: 'sellers', title: 'Marchands Adjamé', icon: Package }
  ];

  const faqs = [
    {
      category: 'delivery',
      q: 'Comment fonctionne la livraison des commandes sur Djassa ?',
      a: 'Dès que votre commande est confirmée sur DJASSA, le vendeur vous contacte et organise directement la livraison à l’extérieur de DJASSA selon l’adresse et les repères que vous avez indiqués.'
    },
    {
      category: 'delivery',
      q: 'Combien de temps prend la livraison à domicile ?',
      a: 'Les délais sont convenus directement avec la boutique vendeuse. Pour les communes d’Abidjan (Plateau, Cocody, Adjamé, Treichville, Marcory, Yopougon, Abobo, Koumassi), la remise s’effectue généralement dans la journée.'
    },
    {
      category: 'payment',
      q: 'Puis-je payer en espèces à la livraison ?',
      a: 'Oui. Vous pouvez choisir librement entre le paiement à la livraison (sans frais en ligne) et le paiement en ligne par Wave ou Orange Money directement lors du passage de commande.'
    },
    {
      category: 'payment',
      q: 'Comment fonctionne le paiement en ligne Wave et Orange Money ?',
      a: 'Le paiement en ligne via Wave ou Orange Money est confirmé par passerelle sécurisée et votre reçu numérique officiel DJASSA est archivé instantanément dans votre centre de commandes.'
    },
    {
      category: 'guarantee',
      q: 'Que faire si le vêtement ou la chaussure n\'est pas à ma taille ?',
      a: 'Vous bénéficiez de la Garantie Échange Express Djassa 72h. Ouvrez la discussion avec la boutique ou déposez un signalement depuis la rubrique « Signaler un problème ».'
    },
    {
      category: 'guarantee',
      q: 'Comment être remboursé en cas de produit non conforme ?',
      a: 'Si un article ne correspond pas à la vidéo de démonstration, le marchand est tenu de vous rembourser via Wave ou Mobile Money. En cas de litige, l\'administrateur Djassa intervient sous 24h.'
    },
    {
      category: 'sellers',
      q: 'Comment savoir si un vendeur d\'Adjamé est authentique ?',
      a: 'Les vendeurs vérifiés arborent un badge de certification officiel. Leurs boutiques physiques au Marché Gouro, Black Market, ou Forum d\'Adjamé sont contrôlées par nos inspecteurs locaux.'
    },
    {
      category: 'sellers',
      q: 'Puis-je négocier les prix avec les marchands ?',
      a: 'Oui, dans l\'esprit traditionnel du Djassa ! Vous pouvez envoyer un message direct au vendeur pour demander un tarif de gros ou un geste commercial si vous achetez plusieurs articles.'
    }
  ];

  const filteredFaqs = faqs.filter((f) => {
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenSupportChat = async () => {
    setIsOpeningChat(true);
    try {
      await openSupportChat('Assistance client depuis le Centre d\'aide');
      onNavigateToMessages?.();
    } finally {
      setIsOpeningChat(false);
    }
  };

  return (
    <div
      id="help-center-settings-screen"
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
            Centre d'aide
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-5 pb-16">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une réponse (livraison, Wave, taille...)"
            className="w-full bg-[#141414] border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-white/40 outline-none focus:border-[#FF6321]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 text-white/40 hover:text-white"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Categories Carousel */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold">
          {categories.map((c) => {
            const Icon = c.icon;
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl whitespace-nowrap transition active:scale-95 ${
                  isSelected
                    ? 'bg-[#FF6321] text-white shadow'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{c.title}</span>
              </button>
            );
          })}
        </div>

        {/* FAQs list */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block">
            QUESTIONS FRÉQUENTES ({filteredFaqs.length})
          </span>

          {filteredFaqs.length === 0 ? (
            <div className="py-12 text-center text-xs text-white/40">
              Aucun résultat pour cette recherche. Essayez un autre mot-clé.
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-white hover:bg-white/[0.03] transition"
                  >
                    <span className="max-w-[85%]">{faq.q}</span>
                    <ChevronRight
                      className={`w-4 h-4 text-white/40 transition-transform duration-200 flex-shrink-0 ${
                        isOpen ? 'rotate-90 text-[#FF6321]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-white/60 leading-relaxed border-t border-white/5">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* CONTACT SUPPORT HERO */}
        <div className="p-5 bg-gradient-to-br from-[#181818] to-[#121212] border border-white/10 rounded-3xl space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center mx-auto">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Besoin d'aide immédiate ?</h4>
            <p className="text-xs text-white/60 mt-0.5">
              Nos conseillers du marché d'Adjamé sont joignables 7j/7 de 07h à 21h.
            </p>
          </div>
          <div className="flex gap-2 pt-1 text-xs font-bold">
            <a
              href="tel:+2252720000000"
              className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition flex items-center justify-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Appeler le support
            </a>
            <button
              type="button"
              onClick={handleOpenSupportChat}
              disabled={isOpeningChat}
              className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] disabled:opacity-50 text-white transition flex items-center justify-center gap-1.5 shadow"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {isOpeningChat ? 'Ouverture...' : 'Chat direct'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
