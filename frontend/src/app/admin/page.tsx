"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { 
  CheckCircle, 
  XCircle, 
  ShieldAlert, 
  ChevronRight, 
  Image as ImageIcon,
  ExternalLink,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LABEL_NAMES = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc'];

interface DatasetImage {
  id: string;
  image_url: string;
  heatmap_url: string;
  prediction: string;
  confidence: number;
  verified_label: string | null;
  is_verified: boolean;
  source?: string;
  reviewer_email?: string;
  reviewed_by?: string;
  reviewed_at?: any;
  created_at: any;
}

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<DatasetImage | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [filter, setFilter] = useState<'all' | 'user' | 'doctor' | 'verified'>('all');
  const [correctLabel, setCorrectLabel] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "dataset_images"));

    if (filter === 'all') {
      q = query(collection(db, "dataset_images"), where("is_verified", "==", false));
    } else if (filter === 'verified') {
      q = query(collection(db, "dataset_images"), where("is_verified", "==", true));
    } else if (filter === 'doctor') {
      q = query(collection(db, "dataset_images"), where("source", "==", "doctor"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DatasetImage[];

      if (filter === 'user') {
        docs = docs.filter(d => d.source !== 'doctor');
      }

      docs.sort((a, b) => {
        if (a.source === 'doctor' && b.source !== 'doctor') return -1;
        if (a.source !== 'doctor' && b.source === 'doctor') return 1;
        return 0;
      });

      setImages(docs);
    }, (error) => {
      console.error("Firestore admin dataset_images snapshot error:", error);
    });

    return () => unsubscribe();
  }, [user, filter]);

  const handleVerify = async (isCorrect: boolean) => {
    if (!selectedImage || !user) return;
    setVerifying(true);

    try {
      const finalLabel = isCorrect ? (selectedImage.prediction || selectedImage.verified_label) : correctLabel;
      
      if (!isCorrect && !correctLabel) {
        alert("Please select the correct label first!");
        setVerifying(false);
        return;
      }

      await updateDoc(doc(db, "dataset_images", selectedImage.id), {
        is_verified: true,
        verified_label: finalLabel,
        reviewed_by: user.email,
        reviewed_at: serverTimestamp()
      });

      setVerifying(false);
      setSelectedImage(null);
      setCorrectLabel("");
    } catch (error) {
      console.error("Error verifying image:", error);
      alert("Failed to verify image.");
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <ShieldAlert className="w-20 h-20 text-red-500 mx-auto" />
          <h1 className="text-3xl font-bold">Access Denied</h1>
          <p className="text-gray-400">You must be logged in to access the Human Verification Panel.</p>
          <a href="/" className="inline-block px-8 py-3 bg-blue-600 rounded-full hover:bg-blue-700 transition">Return Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent tracking-tighter">
              Admin Pulse
            </h1>
            <p className="text-gray-500 mt-2 font-medium">Dataset Integrity & Verification Hub</p>
          </div>
          
          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
            {(['all', 'user', 'doctor', 'verified'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === f 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 bg-[#050505] rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col h-[750px] shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-3">
                <ImageIcon className="text-blue-500" size={20} />
                Verification Queue
              </h2>
              <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[10px] font-black border border-blue-500/20">
                {images.length} CASES
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {images.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4"
                  >
                    <CheckCircle className="w-12 h-12 opacity-10" />
                    <p className="font-medium">Queue is empty</p>
                  </motion.div>
                ) : (
                  images.map((img) => (
                    <motion.div
                      key={img.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      onClick={() => setSelectedImage(img)}
                      className={`group p-4 rounded-3xl cursor-pointer transition-all border relative overflow-hidden ${
                        selectedImage?.id === img.id 
                          ? "bg-blue-600/10 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]" 
                          : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="relative">
                          <img 
                            src={img.image_url} 
                            alt="Thumbnail" 
                            className="w-16 h-16 rounded-2xl object-cover bg-black border border-white/10"
                          />
                          {img.source === 'doctor' && (
                            <div className="absolute -top-1 -left-1 bg-gradient-to-br from-blue-500 to-purple-600 p-1 rounded-lg border border-white/20">
                              <ShieldAlert size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-white truncate uppercase text-xs tracking-wider">
                              {img.prediction || img.verified_label}
                            </p>
                            {img.source === 'doctor' && (
                              <span className="text-[8px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">
                                Expert
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-[10px] mt-1 font-bold">
                            {img.is_verified ? "VERIFIED" : `CONF: ${img.confidence}%`}
                          </p>
                        </div>
                        <ChevronRight className={`transition-transform duration-300 ${selectedImage?.id === img.id ? 'translate-x-1 text-blue-500' : 'text-gray-700'}`} />
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white/5 rounded-3xl border border-white/10 p-8 flex flex-col items-center justify-center min-h-[700px] relative overflow-hidden">
            {!selectedImage ? (
              <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                  <ImageIcon className="w-10 h-10 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Select an image to review</h3>
                  <p className="text-gray-500 mt-2 max-w-xs mx-auto">Click on any item in the queue to start human verification process.</p>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="relative group">
                      <p className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-widest">Original Input</p>
                      <img 
                        src={selectedImage.image_url} 
                        className="w-full aspect-square object-cover rounded-3xl border border-white/10 shadow-2xl"
                        alt="Case"
                      />
                      <a 
                        href={selectedImage.image_url} 
                        target="_blank" 
                        className="absolute top-4 right-4 bg-black/50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-widest">Grad-CAM Heatmap</p>
                    <img 
                      src={selectedImage.heatmap_url} 
                      className="w-full aspect-square object-cover rounded-3xl border border-white/10 shadow-2xl bg-black"
                      alt="Heatmap"
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-6">
                  <div className="flex flex-wrap justify-between items-end gap-6">
                    <div>
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">AI Classification</p>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-black uppercase text-blue-400">{selectedImage.prediction || selectedImage.verified_label}</span>
                        {selectedImage.confidence && (
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold border border-blue-500/30">
                            {selectedImage.confidence}% Confidence
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                          📊 Similar Cases Reported: {images.filter(i => (i.prediction || i.verified_label) === (selectedImage.prediction || selectedImage.verified_label)).length} cases in database
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 max-w-sm">
                      <p className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-2 text-right">Correction label</p>
                      <select 
                        value={correctLabel}
                        onChange={(e) => setCorrectLabel(e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition"
                      >
                        <option value="">Select Correction (if wrong)</option>
                        {LABEL_NAMES.map(l => (
                          <option key={l} value={l}>{l.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4 border-t border-white/10 pt-6">
                    <button
                      onClick={() => handleVerify(true)}
                      disabled={verifying}
                      className="flex-1 h-14 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-900/20"
                    >
                      {verifying ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-6 h-6" />}
                      Prediction is Correct
                    </button>
                    <button
                      onClick={() => handleVerify(false)}
                      disabled={verifying || !correctLabel}
                      className="flex-1 h-14 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white disabled:opacity-50 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all"
                    >
                      {verifying ? <Loader2 className="animate-spin" /> : <XCircle className="w-6 h-6" />}
                      Mark as Incorrect
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
