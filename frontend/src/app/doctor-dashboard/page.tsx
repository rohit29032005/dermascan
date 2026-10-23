"use client";

import DoctorDashboard from "@/components/DoctorDashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export default function DoctorPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <ProtectedRoute allowedRoles={['doctor']}>
      <DoctorDashboard user={user} />
    </ProtectedRoute>
  );
}
