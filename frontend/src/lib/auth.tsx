import { createContext, useContext, useState, type ReactNode } from "react";
import { api, loadSession, saveSession } from "./api";
import type { Session } from "./types";

type Auth = {
  session: Session | null;
  login: (teamId: number | null, pin: string) => Promise<Session>;
  logout: () => void;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(loadSession);

  const update = (next: Session | null) => {
    saveSession(next);
    setSession(next);
  };

  const login: Auth["login"] = async (teamId, pin) => {
    const next = await api<Session>("/auth/login", "POST", { team_id: teamId, pin });
    update(next);
    return next;
  };

  return (
    <AuthContext.Provider value={{ session, login, logout: () => update(null) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}
