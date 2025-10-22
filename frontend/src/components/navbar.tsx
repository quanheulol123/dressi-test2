import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/white_dressi_logo.png";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [hasCompletedStyleTest, setHasCompletedStyleTest] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("styleTestCompleted") === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromStorage = () => {
      const completed = localStorage.getItem("styleTestCompleted") === "true";
      setHasCompletedStyleTest(completed);
    };

    const handleStatusEvent = (event: Event) => {
      const custom = event as CustomEvent<{ completed?: boolean }>;
      if (custom.detail && typeof custom.detail.completed === "boolean") {
        setHasCompletedStyleTest(custom.detail.completed);
      } else {
        syncFromStorage();
      }
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("styleTestStatusChange", handleStatusEvent as EventListener);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("styleTestStatusChange", handleStatusEvent as EventListener);
    };
  }, []);

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  const isAdmin = user?.isAdmin === true;

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-black border-b border-white/10">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center">
          <img
            src={logo}
            alt="Dressi Logo"
            className="h-20 w-25 object-contain"
          />
        </Link>
        <div className="flex items-center gap-3 sm:gap-6">
          {!hasCompletedStyleTest && (
            <Link
              to="/style-discovery"
              className="text-white text-base font-medium px-2 py-1 rounded transition hover:bg-neutral-900"
            >
              Style Discovery
            </Link>
          )}

          {hasCompletedStyleTest && (
            <Link
              to="/curated"
              className="text-white text-base font-medium px-2 py-1 rounded transition hover:bg-neutral-900"
            >
              Curated
            </Link>
          )}

          {user ? (
            <>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="text-white text-base font-medium px-2 py-1 rounded transition hover:bg-neutral-900"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                to="/profile"
                className="bg-pink-500 text-white text-base font-semibold px-4 py-1.5 rounded transition hover:bg-pink-400 shadow"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-white text-base font-medium px-2 py-1 rounded transition hover:bg-neutral-900"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-white text-base font-medium px-2 py-1 rounded transition hover:bg-neutral-900"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="bg-pink-500 text-white text-base font-semibold px-4 py-1.5 rounded transition hover:bg-pink-400 shadow"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
