import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../api/client";

export type UserCorporation = {
  id: number;
  name: string;
  icon?: string | null;
  canWorkAnywhere?: boolean;
  rankId?: number | null;
  rankName?: string | null;
  rankOrder?: number | null;
  isManager?: boolean;
  weeklyShifts?: number;
  totalShifts?: number;
};

export type User = {
  id: number;
  username: string;
  mail?: string | null;
  rank?: number;
  figure?: string | null;

  health?: number;
  maxHealth?: number;
  energy?: number;
  maxEnergy?: number;

  credits?: number;
  bank_amount?: number;
  bank_credits?: number;
  kd?: number;

  kills?: number;
  deaths?: number;
  punches_thrown?: number;
  punches_received?: number;
  arrests_made?: number;
  arrests_amount?: number;
  damage_dealt?: number;
  damage_received?: number;

  level?: number;
  corporation?: UserCorporation | null;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function normalizeUser(u: any): User {
  const corporation = u?.corporation
    ? {
        id: Number(u.corporation.id ?? 0),
        name: String(u.corporation.name ?? ""),
        icon: u.corporation.icon ?? null,
        canWorkAnywhere: Boolean(u.corporation.canWorkAnywhere),
        rankId:
          u.corporation.rankId != null ? Number(u.corporation.rankId) : null,
        rankName: u.corporation.rankName ?? null,
        rankOrder:
          u.corporation.rankOrder != null ? Number(u.corporation.rankOrder) : null,
        isManager: Boolean(u.corporation.isManager),
        weeklyShifts: Number(u.corporation.weeklyShifts ?? 0),
        totalShifts: Number(u.corporation.totalShifts ?? 0),
      }
    : null;

  return {
    id: Number(u?.id ?? 0),
    username: String(u?.username ?? ""),
    mail: u?.mail ?? null,
    rank: u?.rank != null ? Number(u.rank) : 0,
    figure: u?.figure ?? u?.look ?? null,

    health: Number(u?.health ?? u?.current_health ?? 0),
    maxHealth: Number(u?.maxHealth ?? u?.max_health ?? 0),
    energy: Number(u?.energy ?? 0),
    maxEnergy: Number(u?.maxEnergy ?? u?.max_energy ?? 0),

    credits: u?.credits != null ? Number(u.credits) : undefined,
    bank_amount:
      u?.bank_amount != null
        ? Number(u.bank_amount)
        : u?.bank_credits != null
          ? Number(u.bank_credits)
          : undefined,
    bank_credits: u?.bank_credits != null ? Number(u.bank_credits) : undefined,
    kd: u?.kd != null ? Number(u.kd) : undefined,

    kills: u?.kills != null ? Number(u.kills) : undefined,
    deaths: u?.deaths != null ? Number(u.deaths) : undefined,
    punches_thrown:
      u?.punches_thrown != null ? Number(u.punches_thrown) : undefined,
    punches_received:
      u?.punches_received != null ? Number(u.punches_received) : undefined,
    arrests_made: u?.arrests_made != null ? Number(u.arrests_made) : undefined,
    arrests_amount:
      u?.arrests_amount != null ? Number(u.arrests_amount) : undefined,
    damage_dealt: u?.damage_dealt != null ? Number(u.damage_dealt) : undefined,
    damage_received:
      u?.damage_received != null ? Number(u.damage_received) : undefined,

    level: u?.level != null ? Number(u.level) : 0,
    corporation,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res: any = await api.me();
      setUser(normalizeUser(res.user));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const onBanned = () => {
      setUser(null);
      api.logout().catch(() => {});
    };

    window.addEventListener("auth:banned", onBanned as any);
    return () => window.removeEventListener("auth:banned", onBanned as any);
  }, []);

  useEffect(() => {
    if (!user) return;

    const id = window.setInterval(() => {
      refresh().catch(() => {});
    }, 12000);

    return () => window.clearInterval(id);
  }, [user]);

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
