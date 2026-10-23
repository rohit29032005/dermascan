"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, User as UserIcon, ShieldCheck, Stethoscope } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'user' | 'doctor' | 'admin'>('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { refreshRole } = useAuth();
  const router = useRouter();

  // Helper to handle user document creation/update
  const handleUserInitialization = async (user: any, selectedRole: string) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      let locationData: { lat: number | null, lng: number | null } = { lat: null, lng: null };

      // Request location natively
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        } catch (locationErr) {
          console.warn("Location prompt denied or failed", locationErr);
        }
      }

      const initialStatus = selectedRole === 'user' ? 'approved' : 'pending';

      await setDoc(userRef, {
        email: user.email,
        role: selectedRole,
        status: initialStatus,
        createdAt: serverTimestamp(),
        location: locationData
      });
    } else if (!userSnap.data().role) {
      // If user exists but role is missing (data correction)
      await setDoc(userRef, { role: selectedRole }, { merge: true });
    }

    // Refresh context and perform explicit redirect to beat the listener
    await refreshRole();
    const finalRole = selectedRole; // Fallback to current selected if it's a new signup
    
    if (finalRole === 'admin') router.push('/admin-dashboard');
    else if (finalRole === 'doctor') router.push('/doctor-dashboard');
    else router.push('/chat');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        // For login, we still fetch the role to ensure correct redirect
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        const userRole = userDoc.data()?.role || 'user';
        
        await refreshRole();
        if (userRole === 'admin') router.push('/admin-dashboard');
        else if (userRole === 'doctor') router.push('/doctor-dashboard');
        else router.push('/chat');
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await handleUserInitialization(result.user, role);
      }
    } catch (err: any) {
      setError(err.message.replace('Firebase:', '').trim());
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      // Check if user already has a role
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      const existingRole = userDoc.data()?.role;

      if (existingRole) {
        await refreshRole();
        if (existingRole === 'admin') router.push('/admin-dashboard');
        else if (existingRole === 'doctor') router.push('/doctor-dashboard');
        else router.push('/chat');
      } else {
        await handleUserInitialization(result.user, role);
      }
    } catch (err: any) {
      setLoading(false);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message.replace('Firebase:', '').trim());
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white p-4">
      <div className="w-full max-w-md rounded-[2.5rem] bg-[#111] p-10 shadow-2xl border border-white/5 backdrop-blur-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-blue-600/10 rounded-2xl mb-4 border border-blue-500/20">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-2">
            {isLogin ? 'Welcome Back' : 'Join DermaScan'}
          </h2>
          <p className="text-gray-500 font-medium">
            {isLogin ? 'Access your skin health dashboard' : 'Start your AI-powered health journey'}
          </p>
        </div>
        
        {error && (
          <div className="mb-6 rounded-2xl bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20 animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Select Your Role</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'user', icon: UserIcon, label: 'User' },
                  { id: 'doctor', icon: Stethoscope, label: 'Doctor' },
                  { id: 'admin', icon: ShieldCheck, label: 'Admin' }
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id as any)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                      role === r.id 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                        : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                    }`}
                  >
                    <r.icon className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl bg-white/5 border border-white/5 p-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all font-medium"
              placeholder="name@example.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl bg-white/5 border border-white/5 p-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all font-medium"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="my-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-white/5"></div>
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Social Integration</span>
          <div className="flex-1 h-px bg-white/5"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full h-14 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
            <>
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5" />
              Sign in with Google
            </>
          )}
        </button>

        <p className="mt-8 text-center text-sm font-medium text-gray-500">
          {isLogin ? "New to the platform?" : "Joined us before?"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-blue-500 hover:text-blue-400 font-bold underline underline-offset-4"
          >
            {isLogin ? 'Create one now' : 'Login here'}
          </button>
        </p>
      </div>
    </div>
  );
}
