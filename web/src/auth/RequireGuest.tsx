import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Props = { children: React.ReactNode };

export default function RequireGuest({ children }: Props) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // While auth is bootstrapping, don't flash login/register
  if (loading) return null;

  // If already logged in, bounce them to the app
  if (user) {
    const to = (loc.state as any)?.from?.pathname || "/me";
    return <Navigate to={to} replace />;
  }

  return <>{children}</>;
}
