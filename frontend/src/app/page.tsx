"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Auth from '@/components/Auth';
import { Loader2 } from 'lucide-react';

import { ShieldAlert, Clock, ShieldX, LogOut } from 'lucide-react';

export default function Home() {
  const { user, role, status, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && role && status === 'approved') {
      // Automatic redirection based on role - only if role and status are confirmed
      if (role === 'admin') {
        router.replace('/admin-dashboard');
      } else if (role === 'doctor') {
        router.replace('/doctor-dashboard');
      } else if (role === 'user') {
        router.replace('/chat');
      }
    }
  }, [user, role, status, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="animate-pulse text-blue-400 font-medium tracking-widest uppercase text-xs">Initializing DermaScan...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show Auth
  if (!user) {
    return <Auth />;
  }

  // Handle Pending Status
  if (status === 'pending') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white p-6">
        <div className="max-w-md w-full bg-[#111] p-10 rounded-[2.5rem] border border-white/5 text-center space-y-8 backdrop-blur-3xl shadow-2xl">
          <div className="inline-flex items-center justify-center p-6 bg-yellow-500/10 rounded-3xl border border-yellow-500/20">
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight">Approval Pending</h1>
            <p className="text-gray-500 font-medium">Your account is currently under review by our medical directors. This typically takes 24-48 hours.</p>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-full h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest transition-all border border-white/5 flex items-center justify-center gap-3"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Handle Rejected Status
  if (status === 'rejected') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white p-6">
        <div className="max-w-md w-full bg-[#111] p-10 rounded-[2.5rem] border border-red-500/10 text-center space-y-8 backdrop-blur-3xl shadow-2xl">
          <div className="inline-flex items-center justify-center p-6 bg-red-500/10 rounded-3xl border border-red-500/20">
            <ShieldX className="w-12 h-12 text-red-500" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight">Access Denied</h1>
            <p className="text-gray-500 font-medium">Unfortunately, your expert application could not be verified at this time. Please contact support for more details.</p>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-full h-14 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-2xl font-black uppercase tracking-widest transition-all border border-red-500/10 flex items-center justify-center gap-3"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Fallback while redirecting
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="animate-pulse text-blue-400 font-medium uppercase text-xs tracking-widest">Routing to your dashboard...</p>
      </div>
    </div>
  );
}
