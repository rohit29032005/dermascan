"use client";

import ChatDashboard from "@/components/ChatDashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export default function ChatPage() {
  const { user } = useAuth();

  if (!user) return null; // ProtectedRoute will handle redirect

  return (
    <ProtectedRoute allowedRoles={['user', 'doctor']}>
      <ChatDashboard user={user} />
    </ProtectedRoute>
  );
}
