import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { usePoll } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Team } from "../lib/types";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data: teams } = usePoll<Team[]>("/teams", 60_000);
  const [who, setWho] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const session = await login(who === "admin" ? null : Number(who), pin);
      navigate(session.role === "captain" ? "/dashboard" : "/auction");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="stripes flex min-h-[70vh] items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <Logo className="mx-auto h-16 w-16" />
        <h1 className="text-center text-3xl">Sign in</h1>
        <label className="block text-sm font-bold">
          I am
          <select className="field mt-1 font-normal" required value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="" disabled>
              Choose…
            </option>
            {teams?.map((team) => (
              <option key={team.id} value={team.id}>
                {team.captain} · {team.name}
              </option>
            ))}
            <option value="admin">Auctioneer (admin)</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          Access code
          <input
            className="field mt-1 font-normal"
            type="password"
            required
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        {error && <p role="alert" className="font-bold">{error}</p>}
        <button className="btn w-full">Sign in</button>
      </form>
    </section>
  );
}
