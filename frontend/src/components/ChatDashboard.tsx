"use client";
import React, { useState, useEffect, useRef } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  updateDoc 
} from 'firebase/firestore';
import { 
  UploadCloud, 
  Send, 
  MessageSquare, 
  Plus, 
  LogOut, 
  Loader2, 
  Info, 
  MapPin, 
  Stethoscope, 
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  X,
  Layers,
  ChevronRight,
  ExternalLink,
  Sparkles,
  BarChart2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '@/lib/api';

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  lastUpdated: any;
}

interface SimilarCaseItem {
  score?: number;
  similarity?: number;
  image_id?: string;
  disease?: string;
  disease_name?: string;
  confidence?: number;
  image_url?: string;
  is_verified?: boolean;
  source?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image_url?: string;
  prediction?: string;
  disease_name?: string;
  disease_full_name?: string;
  disease_type?: string;
  clinical_notes?: string;
  confidence?: string | number;
  confidence_value?: number;
  severity?: number;
  heatmap_url?: string;
  similar_cases_reported?: number;
  similar_cases_found?: number;
  verified_cases_reported?: number;
  total_platform_cases?: number;
  similar_cases?: SimilarCaseItem[];
  timestamp: any;
  doctors?: any[];
}

export default function ChatDashboard({ user }: { user: User }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeReportCase, setActiveReportCase] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Questionnaire states
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [qData, setQData] = useState({
    age: '',
    gender: '',
    location: '',
    duration: '',
    painScale: '1',
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!user) return;
    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const q = query(chatsRef, orderBy('lastUpdated', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(loadedChats);

      if (loadedChats.length > 0 && !activeChat) {
        setActiveChat(loadedChats[0].id);
      } else if (loadedChats.length === 0) {
        createNewChat();
      }
    }, (error) => {
      console.error("Firestore chats listener permission/network error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !activeChat) return;

    const messagesRef = collection(db, 'users', user.uid, 'chats', activeChat, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(loadedMessages);
    }, (error) => {
      console.error("Firestore messages listener permission/network error:", error);
    });

    return () => unsubscribe();
  }, [user, activeChat]);

  const updateChatMetadata = async (chatId: string, lastMessage: string) => {
    if (!user) return;
    const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
    await updateDoc(chatRef, {
      lastMessage,
      lastUpdated: serverTimestamp()
    });
  };

  const createNewChat = async () => {
    if (!user) return;
    const newChatId = Math.random().toString(36).substr(2, 9);
    
    const chatRef = doc(db, 'users', user.uid, 'chats', newChatId);
    await setDoc(chatRef, {
      title: 'New Skin Analysis',
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastUpdated: serverTimestamp()
    });

    const messagesRef = collection(db, 'users', user.uid, 'chats', newChatId, 'messages');
    await addDoc(messagesRef, {
      role: 'assistant',
      content: 'Welcome! You can upload a skin image to begin diagnosis.',
      timestamp: serverTimestamp()
    });

    setActiveChat(newChatId);
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
      await setDoc(chatRef, {}); 
      
      const idToken = await user.getIdToken();
      await fetch(`${API_BASE_URL}/api/delete-chat?chat_id=${chatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` }
      });

      if (activeChat === chatId) {
        setActiveChat(null);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const deleteAllChats = async () => {
    if (!user || !confirm("Are you sure you want to delete ALL chats? This cannot be undone.")) return;
    
    try {
      const idToken = await user.getIdToken();
      await fetch(`${API_BASE_URL}/api/delete-all-chats`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setActiveChat(null);
    } catch (error) {
      console.error("Delete all failed:", error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPendingImage(file);
      setShowQuestionnaire(true);
    }
  };

  const handleQuestionnaireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowQuestionnaire(false);
    if (!pendingImage || !activeChat || !user) return;

    setIsTyping(true);

    try {
      const formData = new FormData();
      formData.append('file', pendingImage);
      formData.append('chat_id', activeChat);
      formData.append('questionnaire', JSON.stringify(qData));

      const idToken = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/upload-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');

      const messagesRef = collection(db, 'users', user.uid, 'chats', activeChat, 'messages');
      await addDoc(messagesRef, {
        role: "user",
        content: "Uploaded an image for analysis.",
        image_url: data.image_url,
        timestamp: serverTimestamp()
      });

      const reportedCount = data.similar_cases_reported ?? (data.similar_cases_found || 0);
      const foundCount = data.similar_cases_found || 0;
      const verifiedCount = data.verified_cases_reported || 0;
      const conditionName = data.disease_name ? `${data.disease_name} (${data.prediction.toUpperCase()})` : data.prediction;

      let baseContent = `### AI Diagnosis & Screening Result\n\n- **Detected Condition:** ${conditionName}\n- **Clinical Category:** ${data.disease_type || 'Clinical Screening Pattern'}\n- **Confidence Level:** ${data.confidence}\n`;
      if (data.severity) baseContent += `- **Severity Index:** ${data.severity.toFixed(2)} / 100\n`;
      baseContent += `- **Similar Cases Reported:** **${reportedCount} cases** recorded in our clinical research repository (${foundCount} visual vector matches identified).\n`;
      baseContent += `\nI have generated a Grad-CAM heatmap highlighting specific lesion features identified by our vision model. You can also inspect the detailed **Similar Case Report** below for comparative historical case profiles.\n\n*Important: This analysis is based strictly on visual patterns and provided questionnaire data. It is NOT a medical diagnosis. Please seek professional advice from a certified dermatologist.*`;

      await addDoc(messagesRef, {
        role: 'assistant',
        content: baseContent,
        image_url: data.image_url,
        heatmap_url: data.heatmap_url,
        prediction: data.prediction,
        disease_name: data.disease_name || data.prediction,
        disease_full_name: data.disease_full_name || data.prediction,
        disease_type: data.disease_type || 'Clinical Lesion',
        clinical_notes: data.clinical_notes || '',
        confidence: data.confidence,
        severity: data.severity || null,
        similar_cases_reported: reportedCount,
        similar_cases_found: foundCount,
        verified_cases_reported: verifiedCount,
        total_platform_cases: data.total_platform_cases || 0,
        similar_cases: data.similar_cases || [],
        timestamp: serverTimestamp()
      });

      await updateChatMetadata(activeChat, "Image Analyzed Successfully");
      await fetchDoctors(data.prediction);
    } catch (err: any) {
      console.error(err);
      const messagesRef = collection(db, 'users', user.uid, 'chats', activeChat, 'messages');
      await addDoc(messagesRef, {
        role: 'assistant',
        content: `**Error:** Failed to process image. ${err.message}`,
        timestamp: serverTimestamp()
      });
    } finally {
      setIsTyping(false);
      setPendingImage(null);
    }
  };

  const fetchDoctors = async (prediction: string) => {
    if (!user || !activeChat) return;
    try {
      let latParam = "";
      let lngParam = "";

      // Attempt to retrieve browser coordinates on-the-fly (with quick fallback)
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 3500,
              maximumAge: 120000,
            });
          });
          if (pos && pos.coords) {
            latParam = `&lat=${pos.coords.latitude}`;
            lngParam = `&lng=${pos.coords.longitude}`;
            // Persist location to user's Firestore profile in background
            const userRef = doc(db, 'users', user.uid);
            setDoc(userRef, { location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }, { merge: true }).catch(() => {});
          }
        } catch (geoErr) {
          console.warn("Geolocation prompt skipped or timed out, using verified regional directory:", geoErr);
        }
      }

      const idToken = await user.getIdToken();
      const diseaseParam = prediction ? `&disease=${encodeURIComponent(prediction)}` : "";
      const res = await fetch(`${API_BASE_URL}/api/doctors?chat_id=${activeChat}${diseaseParam}${latParam}${lngParam}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await res.json();

      if (res.ok && data.doctors && data.doctors.length > 0) {
        const isLive = data.has_location;
        let docList = isLive
          ? `### 📍 Recommended Dermatologists Near You\n\nBased on your location and suspected condition (**${prediction || 'Skin Lesion'}**), here are specialized clinics you can visit:\n\n`
          : `### 🏥 Recommended Clinical Specialists & Dermatology Centers\n\nHere are verified dermatology institutes and tele-consultation clinics for professional clinical examination of **${prediction || 'this skin condition'}**:\n\n`;

        data.doctors.forEach((d: any, idx: number) => {
          docList += `**${idx + 1}. ${d.name}**\n`;
          if (d.specialty) docList += `- **Specialty:** ${d.specialty}\n`;
          docList += `- **Address:** ${d.address}\n`;
          docList += `- **Rating:** ⭐ ${d.rating || '4.8'} / 5.0\n`;
          if (d.contact) docList += `- **Contact / Booking:** ${d.contact}\n`;
          docList += `\n`;
        });
        docList += `*Important: A physical dermoscopy or biopsy by a certified dermatologist is essential for medical confirmation.*`;

        const messagesRef = collection(db, 'users', user.uid, 'chats', activeChat, 'messages');
        await addDoc(messagesRef, {
          role: 'assistant',
          content: docList,
          timestamp: serverTimestamp()
        });
        await updateChatMetadata(activeChat, "Shared 📍 nearby specialists.");
      }
    } catch (err) {
      console.error("Doctor lookup failed", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChat || !user) return;

    const userMsg = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      const messagesRef = collection(db, 'users', user.uid, 'chats', activeChat, 'messages');
      await addDoc(messagesRef, {
        role: 'user',
        content: userMsg,
        timestamp: serverTimestamp()
      });
      await updateChatMetadata(activeChat, userMsg);

      const idToken = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          chatId: activeChat,
          message: userMsg,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Chat failed');

      await addDoc(messagesRef, {
        role: 'assistant',
        content: data.reply,
        timestamp: serverTimestamp()
      });
      await updateChatMetadata(activeChat, data.reply);
    } catch (err: any) {
      console.error(err);
      const messagesRef = collection(db, 'users', user.uid, 'chats', activeChat, 'messages');
      await addDoc(messagesRef, {
        role: 'assistant',
        content: `**Error:** ${err.message}`,
        timestamp: serverTimestamp()
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-blue-500/30">
      {/* Sidebar */}
      <div className="flex w-72 flex-col bg-[#000000] border-r border-white/5 p-4 transition-all overflow-hidden">
        <div className="flex flex-col gap-2 mb-6">
          <button
            onClick={createNewChat}
            className="flex items-center justify-center space-x-2 rounded-xl border border-white/10 p-4 text-sm font-bold transition-all hover:bg-white/5 active:scale-95 group shadow-lg"
          >
            <Plus size={18} className="text-blue-500 group-hover:rotate-90 transition-transform duration-300" />
            <span>New chat</span>
          </button>
          
          <button
            onClick={deleteAllChats}
            className="flex items-center justify-center space-x-2 rounded-xl p-2 text-[10px] font-bold uppercase tracking-widest text-red-500/50 hover:text-red-500 transition-colors"
          >
            Clear History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          <AnimatePresence>
            {chats.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative group"
              >
                <button
                  onClick={() => setActiveChat(c.id)}
                  className={`flex w-full flex-col items-start gap-1 rounded-2xl p-4 text-sm transition-all border ${
                    activeChat === c.id 
                      ? 'bg-blue-600/10 border-blue-500/30' 
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3 truncate">
                      <MessageSquare size={16} className={activeChat === c.id ? "text-blue-500" : "text-gray-500"} />
                      <span className={`truncate font-semibold ${activeChat === c.id ? "text-white" : "text-gray-300"}`}>
                        {c.title}
                      </span>
                    </div>
                  </div>
                  <span className="truncate text-[11px] text-gray-500 ml-7 max-w-[150px]">
                    {c.lastMessage || "No messages yet"}
                  </span>
                </button>
                
                <button 
                  onClick={(e) => deleteChat(c.id, e)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all"
                >
                  <LogOut size={14} className="rotate-180" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="pt-6 border-t border-white/5 mt-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center space-x-3 rounded-xl p-4 text-sm font-bold text-gray-400 transition-all hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col relative w-full bg-[#0a0a0a]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto pb-40 pt-8 custom-scrollbar">
          <AnimatePresence>
            {activeChat ? (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex w-full mb-8 px-6 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div className={`max-w-[85%] flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-xl font-bold shadow-lg ${
                        msg.role === 'user' 
                          ? 'bg-blue-600' 
                          : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      }`}
                    >
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div
                        className={`p-5 rounded-3xl shadow-xl leading-relaxed prose prose-invert max-w-none text-[15px] ${
                          msg.role === 'user' 
                            ? 'bg-[#1a1a1a] border border-white/5 rounded-tr-none' 
                            : 'bg-[#000000] border border-white/5 rounded-tl-none shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
                        }`}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.role === 'user' && msg.image_url && (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 shadow-lg">
                            <img
                              src={msg.image_url}
                              alt="Uploaded lesion"
                              className="max-h-80 w-auto object-contain hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        )}
                      </div>

                      {msg.role === 'assistant' && msg.heatmap_url && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-3 border border-white/10 bg-gradient-to-b from-[#141417] to-[#0a0a0c] backdrop-blur-2xl p-6 rounded-3xl flex flex-col gap-6 shadow-2xl overflow-hidden relative"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ImageIcon size={40}/>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] flex items-center gap-1.5">
                                  <Sparkles size={12} />
                                  Feature Localization
                                </p>
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-widest">
                                  Grad-CAM AI
                                </span>
                              </div>
                              <div className="overflow-hidden rounded-2xl border border-white/10 aspect-square group relative bg-black">
                                <img
                                  src={msg.heatmap_url}
                                  alt="Heatmap"
                                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                                />
                                <div className="absolute bottom-2 left-2 right-2 p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-gray-300 text-center font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                  AI Attention Map Overlay
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col justify-center space-y-4">
                              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Detected Condition</p>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xl font-black text-white truncate">
                                    {msg.disease_name || msg.prediction}
                                  </p>
                                  {msg.prediction && (
                                    <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-wider border border-blue-500/30 shrink-0">
                                      {msg.prediction}
                                    </span>
                                  )}
                                </div>
                                {msg.disease_type && (
                                  <p className="text-[11px] text-gray-400 mt-1 font-medium">
                                    {msg.disease_type}
                                  </p>
                                )}
                              </div>

                              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Prediction Confidence</p>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                     <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${msg.confidence}%` }}
                                      transition={{ duration: 0.8, ease: "easeOut" }}
                                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                     />
                                  </div>
                                  <span className="text-lg font-black text-blue-400">{msg.confidence}%</span>
                                </div>
                              </div>

                              {/* Similar Cases Reported Stat Card */}
                              <div className="bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent p-4 rounded-2xl border border-purple-500/20">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <Layers size={12} />
                                    Similar Cases Reported
                                  </p>
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Database Match
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-2xl font-black text-white">
                                    {msg.similar_cases_reported ?? (msg.similar_cases_found || 0)}
                                  </span>
                                  <span className="text-xs text-gray-400 font-semibold">cases recorded</span>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">
                                  {msg.similar_cases_found || 0} visual vector matches in repository archive
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Action Button: View Full Similar Case Report */}
                          <button
                            type="button"
                            onClick={() => setActiveReportCase(msg)}
                            className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/10 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition-all duration-300 group shadow-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 group-hover:scale-110 transition-transform">
                                <FileSpreadsheet size={20} />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-white flex items-center gap-2">
                                  View Similar Case Report
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 font-extrabold uppercase">
                                    {msg.similar_cases_reported ?? (msg.similar_cases_found || 0)} Cases
                                  </span>
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  Inspect historical matches, similarity scores & clinical epidemiology
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider group-hover:text-white transition-colors">
                              <span>Open Report</span>
                              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-10">
                <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center mb-6 border border-blue-600/20">
                  <Stethoscope className="text-blue-500 w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black mb-4">Welcome to DermaScan AI</h2>
                <p className="text-gray-500 max-w-md">Start a new chat to analyze skin lesions using our state-of-the-art vision model.</p>
              </div>
            )}
          </AnimatePresence>

          {isTyping && (
            <div className="mx-6 mb-8 flex items-start gap-4">
              <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl font-bold bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                AI
              </div>
              <div className="bg-[#1a1a1a] border border-white/5 p-5 rounded-3xl rounded-tl-none flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                />
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest ml-2">Analyzing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-10" />
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#343541] via-[#343541] to-transparent p-6 pt-10">
          <div className="mx-auto max-w-4xl w-full">
            <form
              onSubmit={handleSendMessage}
              className="relative flex items-center rounded-xl border border-gray-600 bg-[#40414F] p-4 shadow-xl focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500"
            >
              <label htmlFor="file-upload" className="cursor-pointer text-gray-400 hover:text-white transition-colors mr-4">
                <UploadCloud size={24} />
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </label>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Send a follow-up question or upload an image..."
                className="flex-1 bg-transparent text-white outline-none placeholder-gray-400"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-50 transition-all ml-2"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Questionnaire Modal Overlay */}
      {showQuestionnaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-[#202123] border border-gray-700 p-8 shadow-2xl">
            <h3 className="mb-6 text-xl font-semibold text-white">Patient Context Required</h3>
            <form onSubmit={handleQuestionnaireSubmit} className="space-y-4">
               <div>
                 <label className="block text-sm text-gray-400 mb-1">Age</label>
                 <input type="number" required value={qData.age} onChange={e => setQData({...qData, age: e.target.value})} className="w-full rounded bg-[#343541] p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. 45" />
               </div>
               <div>
                 <label className="block text-sm text-gray-400 mb-1">Gender</label>
                 <select required value={qData.gender} onChange={e => setQData({...qData, gender: e.target.value})} className="w-full rounded bg-[#343541] p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                   <option value="">Select Gender</option>
                   <option value="Male">Male</option>
                   <option value="Female">Female</option>
                   <option value="Other">Other</option>
                 </select>
               </div>
               <div>
                 <label className="block text-sm text-gray-400 mb-1">Location of lesion</label>
                 <select required value={qData.location} onChange={e => setQData({...qData, location: e.target.value})} className="w-full rounded bg-[#343541] p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                   <option value="">Select Location</option>
                   <option value="Face">Face</option>
                   <option value="Scalp">Scalp</option>
                   <option value="Chest">Chest</option>
                   <option value="Back">Back</option>
                   <option value="Arms/Legs">Arms/Legs</option>
                   <option value="Other">Other</option>
                 </select>
               </div>
               <div>
                 <label className="block text-sm text-gray-400 mb-1">Duration (days)</label>
                 <input type="number" required value={qData.duration} onChange={e => setQData({...qData, duration: e.target.value})} className="w-full rounded bg-[#343541] p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. 14" />
               </div>
               <div>
                 <label className="block text-sm text-gray-400 mb-1">Itching/Pain Level (1-5)</label>
                 <input type="range" min="1" max="5" value={qData.painScale} onChange={e => setQData({...qData, painScale: e.target.value})} className="w-full mt-2" />
                 <div className="text-center text-sm text-gray-400">{qData.painScale}/5</div>
               </div>
               
               <div className="mt-8 flex justify-end space-x-3">
                 <button type="button" onClick={() => { setShowQuestionnaire(false); setPendingImage(null); }} className="rounded px-6 py-2 text-gray-400 hover:text-white hover:bg-gray-800 transition">Cancel</button>
                 <button type="submit" className="rounded bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700 transition">Analyze Image</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Similar Case Clinical Report Modal */}
      {activeReportCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-4xl rounded-3xl bg-[#0f0f13] border border-white/10 shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Epidemiology & Vector Match Report
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">
                      ID: {activeReportCase.id ? activeReportCase.id.slice(0, 8) : 'REF-CASE'}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white mt-0.5">
                    Similar Case Clinical Analysis
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all shadow-md"
                  title="Print or export report to PDF"
                >
                  <Printer size={15} />
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReportCase(null)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-8 custom-scrollbar">
              {/* 4 Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Layers size={13} />
                    Similar Cases Reported
                  </p>
                  <p className="text-3xl font-black text-white">
                    {activeReportCase.similar_cases_reported ?? (activeReportCase.similar_cases_found || 0)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">Total in clinical repository</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600/10 to-transparent border border-purple-500/20">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <BarChart2 size={13} />
                    Visual Vector Matches
                  </p>
                  <p className="text-3xl font-black text-white">
                    {activeReportCase.similar_cases_found || (activeReportCase.similar_cases?.length ?? 0)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">Cosine embedding profiles</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600/10 to-transparent border border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    Verified Records
                  </p>
                  <p className="text-3xl font-black text-white">
                    {activeReportCase.verified_cases_reported ?? 0}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">Dermatologist verified</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-600/10 to-transparent border border-amber-500/20">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    AI Confidence
                  </p>
                  <p className="text-3xl font-black text-white">
                    {activeReportCase.confidence}%
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {activeReportCase.severity ? `Severity: ${activeReportCase.severity.toFixed(1)}/100` : 'Screening prediction'}
                  </p>
                </div>
              </div>

              {/* Lesion Comparison (Input vs Heatmap) */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Stethoscope size={16} className="text-blue-400" />
                      Analyzed Lesion & Feature Localization
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Comparing user uploaded dermoscopic image with AI visual attention map
                    </p>
                  </div>
                  {activeReportCase.prediction && (
                    <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 font-black text-xs uppercase tracking-wider">
                      {activeReportCase.prediction}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Original Input Lesion</p>
                    <div className="aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                      {activeReportCase.image_url ? (
                        <img 
                          src={activeReportCase.image_url} 
                          alt="Patient Lesion" 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="text-center p-6 text-gray-600">
                          <ImageIcon size={32} className="mx-auto mb-2 opacity-40" />
                          <p className="text-xs">Image unavailable</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Grad-CAM Feature Localization</p>
                    <div className="aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                      {activeReportCase.heatmap_url ? (
                        <img 
                          src={activeReportCase.heatmap_url} 
                          alt="Grad-CAM Localization" 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="text-center p-6 text-gray-600">
                          <ImageIcon size={32} className="mx-auto mb-2 opacity-40" />
                          <p className="text-xs">Heatmap unavailable</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300">
                      Condition Profile: <strong className="text-white">{activeReportCase.disease_full_name || activeReportCase.disease_name || activeReportCase.prediction}</strong>
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                      Classification: {activeReportCase.disease_type || 'Clinical Lesion'}
                    </span>
                  </div>
                  {activeReportCase.clinical_notes && (
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {activeReportCase.clinical_notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Historical Matching Cases Gallery */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers size={16} className="text-purple-400" />
                      Historical Similar Cases Retrieved From Database
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Top similar cases ranked by high-dimensional vector cosine similarity
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20">
                    {activeReportCase.similar_cases?.length || 0} Matches
                  </span>
                </div>

                {activeReportCase.similar_cases && activeReportCase.similar_cases.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {activeReportCase.similar_cases.map((sc, idx) => (
                      <div 
                        key={idx}
                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-blue-500/40 hover:bg-white/[0.04] transition-all flex flex-col gap-3 group"
                      >
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50 border border-white/5">
                          {sc.image_url ? (
                            <img 
                              src={sc.image_url} 
                              alt={`Similar case ${idx + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-1">
                              <ImageIcon size={24} className="opacity-40" />
                              <span className="text-[9px] uppercase tracking-wider">Vector Profile Match</span>
                            </div>
                          )}

                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-black text-blue-400 border border-blue-500/30">
                            #{idx + 1}
                          </div>

                          {sc.is_verified && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/80 backdrop-blur-md text-[9px] font-black text-white flex items-center gap-1 shadow">
                              <ShieldCheck size={10} />
                              Doctor Verified
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white uppercase tracking-wider">
                              {sc.disease_name || sc.disease?.toUpperCase() || 'Case Match'}
                            </span>
                            {sc.confidence && (
                              <span className="text-[10px] font-bold text-gray-400">
                                {sc.confidence}% Conf
                              </span>
                            )}
                          </div>

                          {/* Similarity Score Bar */}
                          <div>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-gray-400 font-semibold">Similarity Match</span>
                              <span className="text-blue-400 font-black">
                                {sc.similarity ?? sc.score ?? 0}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                                style={{ width: `${Math.min(100, sc.similarity ?? sc.score ?? 0)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-2">
                    <Layers size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-sm font-bold text-gray-300">
                      Historical cases are catalogued as user and doctor scans are processed.
                    </p>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Currently {activeReportCase.similar_cases_reported ?? 0} total cases for this condition are tracked in the clinical database registry.
                    </p>
                  </div>
                )}
              </div>

              {/* Epidemiological Summary Note */}
              <div className="p-5 rounded-2xl bg-blue-950/20 border border-blue-500/20 flex items-start gap-4">
                <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-gray-300 leading-relaxed">
                  <p className="font-bold text-white">
                    Clinical Epidemiology & Database Context
                  </p>
                  <p>
                    Our research repository contains <strong>{activeReportCase.similar_cases_reported ?? (activeReportCase.similar_cases_found || 0)} reported cases</strong> of <strong>{activeReportCase.disease_name || activeReportCase.prediction}</strong>. 
                    Visual embeddings from the lesion are indexed using deep feature vectors extracted from our EfficientNet architecture to retrieve geometrically and morphologically analogous patterns.
                  </p>
                </div>
              </div>

              {/* Medical Notice */}
              <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/20 flex items-start gap-4">
                <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-gray-300 leading-relaxed">
                  <p className="font-bold text-red-400">
                    Important Medical Screening Disclaimer
                  </p>
                  <p>
                    This report represents an algorithmic screening assessment based on computer vision patterns. It is strictly educational and research-oriented, and does NOT constitute a definitive medical diagnosis. Always consult a board-certified dermatologist for clinical dermatoscopy or biopsy.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 bg-white/[0.02] flex items-center justify-between flex-wrap gap-4">
              <span className="text-xs text-gray-500 font-medium">
                DermaScan AI Research System &bull; Version 2.0
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  <Printer size={15} />
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReportCase(null)}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
