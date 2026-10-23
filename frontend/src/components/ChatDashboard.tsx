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
  Image as ImageIcon 
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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image_url?: string;
  prediction?: string;
  confidence?: number;
  severity?: number;
  heatmap_url?: string;
  timestamp: any;
  doctors?: any[];
}

export default function ChatDashboard({ user }: { user: User }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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

      let baseContent = `### AI Diagnosis Result\n\n- **Detected Condition:** ${data.prediction}\n- **Confidence Level:** ${data.confidence}\n`;
      if (data.severity) baseContent += `- **Severity Index:** ${data.severity.toFixed(2)} / 100\n`;
      baseContent += `\nI have generated a Grad-CAM heatmap highlighting the specific areas our AI identified. You can also view the results below.\n\n*Important: This analysis is based strictly on visual patterns and provided questionnaire data. It is NOT a medical diagnosis. Please seek professional advice from a certified dermatologist.*`;
      if (data.similar_cases_found > 0) baseContent += `\n\n--- \n**Historical Context:** Found **${data.similar_cases_found}** similar cases in our secure database for reference analysis.`;

      await addDoc(messagesRef, {
        role: 'assistant',
        content: baseContent,
        image_url: data.image_url,
        heatmap_url: data.heatmap_url,
        prediction: data.prediction,
        confidence: data.confidence,
        severity: data.severity || null,
        timestamp: serverTimestamp()
      });

      await updateChatMetadata(activeChat, "Image Analyzed Successfully");
      fetchDoctors(data.prediction);
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
      const idToken = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/doctors?chat_id=${activeChat}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await res.json();

      if (res.ok && data.doctors && data.doctors.length > 0) {
        let docList = "### Nearby Specialists Recommended for You\n\n";
        data.doctors.forEach((d: any, idx: number) => {
          docList += `**${idx + 1}. ${d.name}**\n- Address: ${d.address}\n- Rating: ${d.rating || 'N/A'}\n\n`;
        });
        docList += `*You can visit these specialists for a professional clinical examination.*`;
        
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
  }

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
                          className="mt-2 border border-white/5 bg-black/40 backdrop-blur-xl p-6 rounded-3xl flex flex-col gap-6 shadow-2xl overflow-hidden relative"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ImageIcon size={40}/>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                            <div className="space-y-3">
                              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">
                                Feature Localization
                              </p>
                              <div className="overflow-hidden rounded-2xl border border-white/10 aspect-square">
                                <img
                                  src={msg.heatmap_url}
                                  alt="Heatmap"
                                  className="w-full h-full object-cover transition-all hover:scale-110"
                                />
                              </div>
                            </div>
                            
                            <div className="flex flex-col justify-center space-y-6">
                              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Diagnosis</p>
                                <p className="text-2xl font-black text-white">{msg.prediction}</p>
                              </div>
                              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Confidence</p>
                                <div className="flex items-center gap-2">
                                  <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                                     <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: msg.confidence }}
                                      className="h-full bg-blue-500"
                                     />
                                  </div>
                                  <span className="text-xl font-black text-blue-400">{msg.confidence}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
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
    </div>
  );
}
