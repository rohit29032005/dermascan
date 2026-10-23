"use client";

import React, { useState } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  UploadCloud, 
  LogOut, 
  CheckCircle, 
  Loader2, 
  Stethoscope, 
  FileText, 
  ClipboardCheck,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/api';

const LABELS = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc'];

export default function DoctorDashboard({ user }: { user: User }) {
  const { signOut } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSuccess(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !label) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('label', label);
      formData.append('notes', notes);

      const idToken = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/doctor-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      setSuccess(true);
      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setLabel('');
      setNotes('');
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to contribute data. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              <Stethoscope className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">DermaScan <span className="text-blue-500 font-medium">Expert</span></h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Medical Research Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Verified Doctor</p>
            </div>
            <button 
              onClick={() => signOut()}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h2 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Manual Dataset Contribution
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Help improve our diagnostic accuracy by contributing verified clinical cases. 
            All uploads are securely processed and added to our research dataset.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <section>
            <div 
              className={`relative aspect-square rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-8 text-center group ${
                previewUrl ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-blue-500/30 hover:bg-white/5'
              }`}
            >
              <input 
                type="file" 
                onChange={handleFileChange} 
                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                accept="image/*"
              />
              
              <AnimatePresence mode="wait">
                {previewUrl ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full h-full relative"
                  >
                    <img src={previewUrl} className="w-full h-full object-cover rounded-2xl shadow-2xl" alt="Preview" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                      <p className="text-sm font-bold bg-white text-black px-4 py-2 rounded-full shadow-lg">Change Image</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20 group-hover:scale-110 transition-transform">
                      <UploadCloud className="text-blue-500 w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Upload Clinical Photo</p>
                      <p className="text-gray-500 text-sm mt-1">Drag and drop or click to browse</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Form Section */}
          <section className="bg-white/5 rounded-3xl border border-white/5 p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                  <ClipboardCheck size={14} className="text-blue-500" />
                  Clinical Diagnosis
                </label>
                <select 
                  required
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer hover:border-white/20"
                >
                  <option value="">Select Label</option>
                  {LABELS.map(l => (
                    <option key={l} value={l}>{l.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                  <FileText size={14} className="text-blue-500" />
                  Clinical Notes (Optional)
                </label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Enter specific lesion characteristics or patient history..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px] resize-none hover:border-white/20"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFile || !label || submitting}
                className={`w-full h-14 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg ${
                  selectedFile && label && !submitting
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/40'
                    : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                }`}
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <UploadCloud size={20} />
                    Submit Contribution
                  </>
                )}
              </button>
            </form>
          </section>
        </div>

        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-12 bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                <CheckCircle className="text-green-500 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Contribution Received</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                "Thanks for your time, Doctor. Your contribution improves the AI system's clinical accuracy."
              </p>
              <button 
                onClick={() => setSuccess(false)}
                className="mt-6 text-sm font-bold text-green-500 hover:text-green-400 transition-colors underline decoration-2 underline-offset-8"
              >
                Submit another case
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Background decoration */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
}
