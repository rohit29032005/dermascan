"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { 
  ShieldCheck, 
  ShieldAlert,
  Users, 
  Clock, 
  XCircle, 
  CheckCircle, 
  ChevronRight, 
  LogOut, 
  Loader2,
  Stethoscope,
  Shield,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserRecord {
  id: string;
  email: string;
  role: 'user' | 'doctor' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  approvedBy?: string;
}

export default function SuperAdminDashboard() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending_doctors' | 'pending_admins'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Session Check
    const session = localStorage.getItem('superadmin_session');
    if (!session) {
      router.replace('/super-admin');
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      setPermissionError(null);
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.warn("Super Admin anonymous auth error:", err);
        }
      }

      const q = query(collection(db, 'users'));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserRecord[];
        
        // Manual sort by createdAt to avoid index requirement
        docs.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tB - tA;
        });

        setUsers(docs);
        setLoading(false);
        setPermissionError(null);
      }, (error) => {
        console.error("Firestore users snapshot error:", error);
        if (error.code === 'permission-denied' || error.message.includes('permissions')) {
          setPermissionError("Firebase Permission Denied: Your Firebase Console Security Rules are blocking access to the 'users' collection. Please publish the recommended rules in Firebase Console.");
        } else {
          setPermissionError(error.message);
        }
        setLoading(false);
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router]);

  const handleAction = async (userId: string, status: 'approved' | 'rejected') => {
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: status,
        approvedBy: status === 'approved' ? 'superadmin' : null,
        updatedAt: new Date()
      });
    } catch (error: any) {
      console.error("Action failed:", error);
      alert("Failed to update user status: " + (error.message || "Permission Denied"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('superadmin_session');
    router.replace('/super-admin');
  };

  const filteredUsers = users.filter(u => {
    const emailStr = u.email || '';
    const matchesSearch = emailStr.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'pending_doctors') return u.role === 'doctor' && u.status === 'pending' && matchesSearch;
    if (filter === 'pending_admins') return u.role === 'admin' && u.status === 'pending' && matchesSearch;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-white/5 pb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600/10 rounded-2xl border border-red-500/20">
              <ShieldCheck className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter">Root Console</h1>
              <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                System Core: Authenticated as Rohit
              </p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Deauthorize
          </button>
        </header>

        {permissionError && (
          <div className="mb-8 p-6 bg-red-950/40 border border-red-500/40 rounded-3xl text-red-300 shadow-2xl flex flex-col gap-2">
            <h3 className="font-black text-lg text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Firebase Permission Error
            </h3>
            <p className="text-sm">{permissionError}</p>
            <p className="text-xs text-red-400/80 mt-1 font-mono">
              Action Required: Go to Firebase Console &gt; Firestore Database &gt; Rules, and set match /users/&#123;userId&#125; &#123; allow read, write: if true; &#125;
            </p>
          </div>
        )}

        {/* Stats & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-[#111] p-6 rounded-3xl border border-white/5">
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Entities</p>
            <p className="text-3xl font-black">{users.length}</p>
          </div>
          <div className="bg-[#111] p-6 rounded-3xl border border-white/5">
            <p className="text-red-500 text-xs font-black uppercase tracking-widest mb-1">Pending Review</p>
            <p className="text-3xl font-black">{users.filter(u => u.status === 'pending').length}</p>
          </div>
          
          <div className="md:col-span-2 flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {(['all', 'pending_doctors', 'pending_admins'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filter === f 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Main List */}
        <div className="bg-[#0a0a0a] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <Users className="text-red-500" size={24} />
              Entity Registry
            </h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input 
                type="text"
                placeholder="Search by identity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 outline-none focus:border-red-500/30 transition-all text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-gray-500 uppercase text-[10px] font-black tracking-[0.2em]">
                  <th className="px-8 py-6">Identity</th>
                  <th className="px-8 py-6">Role</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-gray-600 font-medium">
                        No entities matched the current projection.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <motion.tr 
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-white/[0.01] transition-colors group"
                      >
                        <td className="px-8 py-6">
                          <p className="font-bold text-white mb-0.5">{u.email}</p>
                          <p className="text-[10px] text-gray-600 font-medium font-mono">{u.id}</p>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            {u.role === 'doctor' ? (
                              <Stethoscope className="w-3 h-3 text-blue-400" />
                            ) : u.role === 'admin' ? (
                              <Shield className="w-3 h-3 text-purple-400" />
                            ) : (
                              <Users className="w-3 h-3 text-gray-400" />
                            )}
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                              u.role === 'doctor' ? 'text-blue-400' : 
                              u.role === 'admin' ? 'text-purple-400' : 'text-gray-400'
                            }`}>
                              {u.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${
                            u.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            u.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                            'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {u.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleAction(u.id, 'approved')}
                                  disabled={!!actionLoading}
                                  className="h-10 px-4 bg-green-600 hover:bg-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                  {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCircle className="w-3 h-3" />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(u.id, 'rejected')}
                                  disabled={!!actionLoading}
                                  className="h-10 px-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                  {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <XCircle className="w-3 h-3" />}
                                  Reject
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-700 tracking-widest">
                                {u.status === 'approved' && <p>Authorized by {u.approvedBy}</p>}
                                {u.status === 'rejected' && <p>Registry Terminated</p>}
                                
                                {u.status === 'approved' && (
                                   <button
                                   onClick={() => handleAction(u.id, 'rejected')}
                                   className="opacity-0 group-hover:opacity-100 transition-opacity ml-4 text-red-500 hover:underline"
                                 >
                                    Revoke Access
                                 </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
