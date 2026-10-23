"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, User, Loader2 } from 'lucide-react';

import { auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

export default function SuperAdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Hardcoded Secure Credentials
    if (username === 'Rohit' && password === '29032005') {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn("Firebase anonymous auth sign-in:", err);
      }
      localStorage.setItem('superadmin_session', 'authenticated_' + Date.now());
      router.push('/super-admin-dashboard');
    } else {
      setError('Invalid root credentials');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white p-4">
      <div className="w-full max-w-md bg-[#111] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-red-500/10 rounded-2xl mb-4 border border-red-500/20">
            <ShieldCheck className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Root Authority</h1>
          <p className="text-gray-500 mt-2 font-medium uppercase text-[10px] tracking-widest">Super Admin Entrance</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20 text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 outline-none focus:border-red-500/50 transition-all font-medium"
                placeholder="Root logic identifier"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 outline-none focus:border-red-500/50 transition-all font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/20 flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Authorize Root Access'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-600 font-medium">
          System Core Access Protocol v2.0
        </p>
      </div>
    </div>
  );
}
