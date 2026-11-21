import React, { useState } from 'react';
import { ShieldCheck, Wallet, DollarSign, Plug, CreditCard, RotateCcw, Package, Flag, Headphones, Truck, MapPin, TicketPercent, Star, Bell, BarChart3, Users, FileText, Database, LogOut, ChevronRight } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';

type Section = 'finance'|'wallet'|'retraits'|'commissions'|'couts'|'paiements'|'remboursements'|'catalogue'|'moderation'|'signalements'|'support'|'livraison'|'zones'|'promotions'|'avis'|'notifications'|'rapports'|'admins'|'journal'|'securite'|'donnees';
const sections: [Section, string, any][] = [
 ['finance','Finance',DollarSign],['wallet','Wallet',Wallet],['retraits','Retraits',RotateCcw],['commissions','Commissions',BarChart3],['couts','Coûts API / services',Plug],['paiements','Paiements',CreditCard],['remboursements','Retours & remboursements',RotateCcw],['catalogue','Catalogue',Package],['moderation','Modération',ShieldCheck],['signalements','Signalements',Flag],['support','Support',Headphones],['livraison','Livraison',Truck],['zones','Zones',MapPin],['promotions','Promotions',TicketPercent],['avis','Avis',Star],['notifications','Notifications',Bell],['rapports','Rapports',FileText],['admins','Administrateurs',Users],['journal','Journal Admin',FileText],['securite','Sécurité',ShieldCheck],['donnees','Données / stockage',Database]
];

export const AdministrationTab: React.FC = () => {
 const { orders, sellers, signOut } = useApp();
 const [section,setSection]=useState<Section>('finance');
 const gmv=orders.reduce((a,o)=>a+o.total,0);
 const estimatedCommissions = orders.filter((o)=>o.status!=='cancelled').length * 150;
 const onlineOrders = orders.filter((o)=>(o.paymentMode||'')==='online'||o.paymentMethod==='wave'||o.paymentMethod==='orange_money').length;
 const codOrders = Math.max(0, orders.length - onlineOrders);
 const data: Record<Section, [string,string][]> = {
  finance:[['GMV',formatFCFA(gmv)],['Commissions fixes (150 F / cmd)',formatFCFA(estimatedCommissions)],['Remboursements','0 FCFA'],['Résultat brut commissions',formatFCFA(estimatedCommissions)]],
  wallet:[['Solde disponible',formatFCFA(estimatedCommissions)],['Commandes en ligne',String(onlineOrders)],['Commandes à la livraison (COD)',String(codOrders)],['Frais livraison DJASSA','0 FCFA']],
  retraits:[['Reversements directs','Wave & Orange Money vendeurs'],['En attente','Suivi admin'],['Validés','Selon confirmations GeniusPay'],['Total versé','Suivi temps réel']],
  commissions:[['Tarif unique DJASSA','150 FCFA fixe / commande'],['Frais paiement en ligne client','6,5% (Wave / Orange Money)'],['Frais client COD','0% (Paiement à la livraison)'],['Total commissions générées',formatFCFA(estimatedCommissions)]],
  couts:[['Paiements GeniusPay','Wave & Orange Money'],['IA Essayage / Vidéo','Suivi crédits clients'],['Notifications','Suivi des usages'],['Stockage médias','Suivi du volume']],
  paiements:[['Wave','Activé (Paiement en ligne + Reversement)'],['Orange Money','Activé (Paiement en ligne + Reversement)'],['Paiement à la livraison (COD)','Activé (0% frais client)'],['Crédits IA Client','Wave / OM / MTN / Carte']],
  remboursements:[['Demandes','Suivi dossier commande'],['En traitement','Arbitrage admin'],['Approuvés','Traçabilité complète'],['Refusés','Motif consigné']],
  catalogue:[['Produits','Catalogue global'],['Catégories','Catégories actives'],['Stocks','Surveillance des stocks'],['Produits signalés','À modérer']],
  moderation:[['Vidéos','À vérifier'],['Photos','À vérifier'],['Publications','À vérifier'],['Contenus signalés','0 critique']],
  signalements:[['Clients','0 critique'],['Vendeurs','1 à examiner'],['Commandes','Médiation admin'],['Produits / vidéos','0 critique']],
  support:[['Nouveaux tickets','4'],['En cours','6'],['Urgents','1'],['Résolus','128']],
  livraison:[['Mode opérationnel','Organisée par le vendeur hors DJASSA'],['Boutiques actives',String(sellers.length)],['Frais livraison DJASSA','0 FCFA'],['Statut commande unique','Commande confirmée']],
  zones:[['Communes','Adjamé, Yopougon, Cocody, Abobo...'],['Zones couvertes','Gérées par chaque boutique'],['Restrictions','Aucune'],['Priorités','Configurables']],
  promotions:[['Campagnes','Actives'],['Codes promo','Gérés ici'],['Réductions','FCFA ou pourcentage'],['Impact financier','Suivi par campagne']],
  avis:[['Avis clients','À modérer si signalés'],['Vendeurs','Notes visibles'],['Produits','Notes et commentaires'],['Avis supprimés','Historique conservé']],
  notifications:[['Clients','Diffusion ciblée'],['Vendeurs','Diffusion ciblée'],['Administrateurs','Alertes système'],['Historique','Archivé']],
  rapports:[['Financiers','Export / analyse'],['Commandes','Statut Commande confirmée'],['Commissions','150 FCFA / commande'],['Rentabilité','Commissions + Abonnements + Ads']],
  admins:[['Super Admin','Accès complet'],['Finance','Accès financier'],['Support','Accès tickets'],['Journal','Actions sensibles tracées']],
  journal:[['Validation','KYC vendeur approuvé'],['Finance','Commission consultée'],['Commande','Dossier ouvert'],['Sécurité','Connexion enregistrée']],
  securite:[['2FA Admin','Renforcée'],['Mots de passe','Jamais visibles'],['Sessions','Surveillées'],['Activités suspectes','Alertes']],
  donnees:[['Médias','Photos / vidéos'],['Stockage','Surveillance du volume'],['Sauvegardes','Préparées pour production'],['Archivage','Historique conservé']]
 };
 const current=sections.find(s=>s[0]===section)!;
 return <div id="admin-tab-administration" className="w-full h-full overflow-y-auto no-scrollbar p-4 md:p-6 pb-24">
  <div className="mb-4"><h2 className="text-lg font-black">Administration</h2><p className="text-xs text-white/45 mt-1">Centre de pilotage interne de DJASSA.</p></div>
  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">{sections.map(([id,label,Icon])=><button key={id} onClick={()=>setSection(id)} className={`shrink-0 px-3 py-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 ${section===id?'bg-purple-600 border-purple-400 text-white':'bg-white/5 border-white/10 text-white/55'}`}><Icon className="w-3.5 h-3.5"/>{label}</button>)}</div>
  <section className="p-4 rounded-2xl bg-white/5 border border-white/10">
   <h3 className="text-sm font-black mb-4">{current[1]}</h3>
   <div className="space-y-2">{data[section].map(([a,b])=><div key={a} className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-4"><span className="text-xs text-white/55">{a}</span><span className="text-xs font-bold text-white text-right">{b}</span><ChevronRight className="w-3 h-3 text-white/20"/></div>)}</div>
  </section>
  <button onClick={signOut} className="mt-4 w-full p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center gap-2"><LogOut className="w-4 h-4"/>Déconnexion</button>
 </div>;
};
