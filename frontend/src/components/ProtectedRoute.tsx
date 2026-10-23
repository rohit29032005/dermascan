"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<'user' | 'doctor' | 'admin'>;
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, status, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    } else if (!loading && user && role && status !== 'approved') {
      // If user is authenticated but not approved, push back to root for gatekeeping
      router.replace("/");
    } else if (!loading && user && role && !allowedRoles.includes(role)) {
      // Redirect based on current role if not authorized for this specific route
      if (role === 'admin') router.replace("/admin-dashboard");
      else if (role === 'doctor') router.replace("/doctor-dashboard");
      else router.replace("/chat");
    }
  }, [user, role, status, loading, router, allowedRoles]);

  if (loading || !user || !role || !allowedRoles.includes(role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="animate-pulse text-blue-400 font-medium">Securing access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
