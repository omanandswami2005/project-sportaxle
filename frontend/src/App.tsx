import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { Logo, Wordmark } from "./components/Logo";
import { useAuth } from "./lib/auth";
import Admin from "./pages/Admin";
import Auction from "./pages/Auction";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Leaderboard from "./pages/Leaderboard";
import Login from "./pages/Login";
import Players from "./pages/Players";

const PAGES = [
  { to: "/auction", label: "Auction", element: <Auction /> },
  { to: "/players", label: "Players", element: <Players /> },
  { to: "/leaderboard", label: "Leaderboard", element: <Leaderboard /> },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 font-bold ${isActive ? "bg-ink text-white" : "hover:bg-mist"}`;

export default function App() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2" aria-label="Main">
          <Link to="/" className="mr-auto flex items-center gap-2" aria-label="Sports Axle home">
            <Logo className="h-9 w-9" />
            <Wordmark className="text-2xl" />
          </Link>
          {PAGES.map(({ to, label }) => (
            <NavLink key={to} to={to} className={navClass}>
              {label}
            </NavLink>
          ))}
          {session?.role === "captain" && (
            <NavLink to="/dashboard" className={navClass}>
              My team
            </NavLink>
          )}
          {session?.role === "admin" && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
          {session ? (
            <button
              className="btn-ghost py-1.5"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Sign out
            </button>
          ) : (
            <Link to="/login" className="btn py-1.5">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          {PAGES.map(({ to, element }) => (
            <Route key={to} path={to} element={element} />
          ))}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <footer className="bg-ink px-4 py-6 text-center text-sm text-white">
        <Wordmark className="text-lg" /> · by Data Axle India · Play. Cheer. Repeat.
      </footer>
    </div>
  );
}
