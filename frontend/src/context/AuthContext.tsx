"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  role: 'user' | 'doctor' | 'admin' | null;
  status: 'pending' | 'approved' | 'rejected' | null;
  approvedBy: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  status: null,
  approvedBy: null,
  loading: true,
  signOut: async () => {},
  refreshRole: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'user' | 'doctor' | 'admin' | null>(null);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setRole(userData.role || 'user');
        setStatus(userData.status || 'pending');
        setApprovedBy(userData.approvedBy || null);
        return { 
          role: userData.role || 'user', 
          status: userData.status || 'pending' 
        };
      } else {
        setRole(null);
        setStatus(null);
        setApprovedBy(null);
        return null;
      }
    } catch (error) {
      console.error("Error fetching role/status:", error);
      setRole('user');
      setStatus('approved'); // Fallback for errors
      return { role: 'user', status: 'approved' };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchRole(currentUser.uid);
      } else {
        setRole(null);
        setStatus(null);
        setApprovedBy(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.uid);
  };

  return (
    <AuthContext.Provider value={{ user, role, status, approvedBy, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
