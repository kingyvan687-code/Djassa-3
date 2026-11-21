import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { AdminUserRecord } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface AdminAddUserModalProps {
  onClose: () => void;
}

export const AdminAddUserModal: React.FC<AdminAddUserModalProps> = ({ onClose }) => {
  const { addAdminUser, showToast } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [role, setRole] = useState<'client' | 'seller' | 'admin'>('client');
  const [location, setLocation] = useState('Cocody');
  const [storeName, setStoreName] = useState('');

  const communes = [
    'Adjamé',
    'Cocody',
    'Yopougon',
    'Plateau',
    'Marcory',
    'Treichville',
    'Koumassi',
    'Port-Bouët',
    'Abobo'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Veuillez renseigner le nom et l’adresse e-mail');
      return;
    }

    const newUser: AdminUserRecord = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      status: 'active',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      createdAt: 'Aujourd’hui',
      location,
      ordersCount: 0,
      totalSpentOrEarned: 0,
      kycVerified: role === 'admin',
      storeName: role === 'seller' ? storeName.trim() || `${name.trim()} Shop` : undefined,
    };

    addAdminUser(newUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md bg-[#121212] border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-black text-white">Ajouter un Utilisateur</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5 no-scrollbar text-xs">
          <div>
            <label className="text-white/70 block mb-1 font-bold">Nom complet :</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Kouadio Yao Patrick"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white focus:border-purple-400 outline-none"
            />
          </div>

          <div>
            <label className="text-white/70 block mb-1 font-bold">Rôle sur la plateforme :</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['client', 'seller', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 rounded-xl font-bold capitalize transition border text-center ${
                    role === r
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-white/5 text-white/60 border-white/10'
                  }`}
                >
                  {r === 'seller' ? 'Vendeur' : r === 'admin' ? 'Admin' : 'Client'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-white/70 block mb-1 font-bold">Adresse e-mail :</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: kouadio@djassa.ci"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white focus:border-purple-400 outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-white/70 block mb-1 font-bold">Numéro de téléphone :</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white focus:border-purple-400 outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-white/70 block mb-1 font-bold">Commune de résidence :</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white focus:border-purple-400 outline-none"
            >
              {communes.map((c) => (
                <option key={c} value={c} className="bg-[#121212] text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {role === 'seller' && (
            <div>
              <label className="text-white/70 block mb-1 font-bold">Nom de la boutique marchande :</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="ex: Yao Mode Adjamé"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white focus:border-purple-400 outline-none"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition active:scale-98"
            >
              Créer le compte maintenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
