import React, { useState } from 'react';
import {
  ChevronLeft,
  FileText,
  Shield,
  Scale,
  ChevronRight,
  Search,
  BookOpen,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface TermsSettingsScreenProps {
  onBack: () => void;
}

export const TermsSettingsScreen: React.FC<TermsSettingsScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'cgu' | 'cgv' | 'privacy' | 'fleet'>('cgu');
  const [searchFilter, setSearchFilter] = useState('');

  const content = {
    cgu: [
      {
        title: 'Article 1 : Objet de la plateforme Djassa',
        text: 'La plateforme mobile Djassa met en relation directe des commerçants et marchands établis dans les marchés d\'Abidjan (Adjamé, Treichville, Cocody) avec des clients acheteurs.'
      },
      {
        title: 'Article 2 : Accès et inscription',
        text: 'L\'accès aux services est réservé aux personnes physiques majeures ou aux personnes morales valablement représentées. L\'utilisateur garantit l\'exactitude des numéros de téléphone et adresses communiqués pour la livraison.'
      },
      {
        title: 'Article 3 : Obligations des utilisateurs',
        text: 'Les utilisateurs s\'engagent à ne publier aucun contenu frauduleux, violent, injurieux ou constitutif de contrefaçon. Tout manquement entraîne la suspension immédiate du profil sans préavis.'
      }
    ],
    cgv: [
      {
        title: 'Article 1 : Prix et tarification en FCFA',
        text: 'Tous les prix indiqués sur Djassa sont libellés en Francs CFA (XOF). Les frais de paiement en ligne (6,5 % côté client) s\'appliquent uniquement aux règlements en ligne par Wave ou Orange Money ; le paiement à la livraison n’entraîne aucuns frais client.'
      },
      {
        title: 'Article 2 : Modalités de règlement',
        text: 'Les commandes peuvent être réglées en ligne via Wave ou Orange Money avec reversement au vendeur sous déduction de la commission fixe DJASSA (150 FCFA), ou en espèces à la livraison directement auprès du vendeur.'
      },
      {
        title: 'Article 3 : Livraison par le vendeur et garantie 72h',
        text: 'Le vendeur organise et assume directement la livraison de chaque commande à l’extérieur de DJASSA. En cas de non-conformité avérée, un échange est assuré sous 72 heures.'
      }
    ],
    privacy: [
      {
        title: 'Article 1 : Collecte conforme ARTCI',
        text: 'Djassa traite les données personnelles conformément à la loi n° 2013-450 relative à la protection des données à caractère personnel en Côte d\'Ivoire régulée par l\'Autorité de Régulation des Télécommunications/TIC de Côte d\'Ivoire (ARTCI).'
      },
      {
        title: 'Article 2 : Coordonnées de livraison',
        text: 'Votre numéro de téléphone et vos repères d\'adresse sont transmis exclusivement à la boutique vendeuse afin qu\'elle organise votre livraison, et ne sont jamais revendus à des fins publicitaires tierces.'
      },
      {
        title: 'Article 3 : Droit d\'accès et de suppression',
        text: 'Conformément aux options du compte, vous pouvez à tout moment télécharger l\'intégralité de vos données d\'achat ou demander la suppression définitive de votre compte.'
      }
    ],
    fleet: [
      {
        title: 'Article 1 : Organisation de la livraison par le vendeur',
        text: 'Chaque marchand partenaire est responsable de l\'emballage, de l\'expédition et de la remise du colis au client à l\'extérieur de la plateforme DJASSA.'
      },
      {
        title: 'Article 2 : Vérification du colis',
        text: 'Le client vérifie la conformité de sa commande à la réception avec les coordonnées et le reçu officiel DJASSA disponibles dans son espace Achats.'
      }
    ]
  };

  const currentArticles = content[activeTab].filter(
    (a) =>
      searchFilter.trim() === '' ||
      a.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      id="terms-settings-screen"
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
            Conditions et Politiques
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16 p-4 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex bg-[#121212] p-1 rounded-2xl border border-white/10 text-xs font-bold gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'cgu', label: 'CGU' },
            { id: 'cgv', label: 'Ventes & Tarifs' },
            { id: 'privacy', label: 'Confidentialité ARTCI' },
            { id: 'fleet', label: 'Charte Coursiers' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-3 rounded-xl whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-[#FF6321] text-white shadow'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search filter within articles */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-white/40 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Rechercher dans les clauses légales..."
            className="w-full bg-[#141414] border border-white/10 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
          />
        </div>

        {/* Articles list */}
        <div className="space-y-3">
          {currentArticles.map((art, idx) => (
            <div
              key={idx}
              className="p-4 bg-[#121212] border border-white/5 rounded-2xl space-y-1.5"
            >
              <h3 className="text-xs font-bold text-[#FF6321] flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                {art.title}
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">{art.text}</p>
            </div>
          ))}
        </div>

        {/* Legal notice footer */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center space-y-1 text-[11px] text-white/40">
          <p>Dernière mise à jour légale : Mars 2026</p>
          <p>Société Djassa Marketplace Côte d'Ivoire · RC Abidjan n° CI-ABJ-2025-B-1284</p>
        </div>
      </main>
    </div>
  );
};
