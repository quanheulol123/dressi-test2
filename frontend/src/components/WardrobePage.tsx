import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type WardrobeItem = {
  id: string;
  name: string;
  image: string;
  tags?: string[];
};

export default function WardrobePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const token = user?.token ?? "";

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WardrobeItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  const requestDelete = (item: WardrobeItem) => {
    setPendingDelete(item);
  };

  const cancelDelete = () => {
    setPendingDelete(null);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const itemId = pendingDelete.id;

    setDeletingId(itemId);

    try {
      const response = await fetch(
        apiUrl(`/api/wardrobe/${encodeURIComponent(itemId)}/`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to delete item");
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setActionFeedback({
        type: "success",
        message: "Removed from your wardrobe.",
      });
    } catch (err) {
      console.error(err);
      setActionFeedback({
        type: "error",
        message: "Unable to delete item. Please try again.",
      });
    } finally {
      setPendingDelete(null);
      setDeletingId(null);
    }
  };

  const wardrobeTitle = useMemo(() => {
    if (!user) return "Your Wardrobe";
    const base = user.displayName || user.email?.split("@")[0] || "Your";
    return `${base}'s Wardrobe`;
  }, [user]);

  const fetchWardrobe = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/get_wardrobe/"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        navigate("/login", { replace: true, state: { from: "/wardrobe" } });
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const wardrobe = Array.isArray(payload?.wardrobe)
      ? (payload.wardrobe as any[]).map(item => ({
          id: item.name, // or item._id if you store it
          name: item.name,
          image: item.image, // <-- directly from backend
          tags: item.tags ?? [],
        }))
      : [];
      setItems(wardrobe);
    } catch (err) {
      console.error("Failed to load wardrobe", err);
      setError("Unable to load your wardrobe. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate, token]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true, state: { from: "/wardrobe" } });
      return;
    }
    fetchWardrobe();
  }, [fetchWardrobe, navigate, token]);

  if (!token) {
    return null;
  }

  return (
    <section className="min-h-screen bg-[#050717] pb-16 pt-20 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 sm:px-8 lg:px-12">
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-white/40">
              Dressi
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {wardrobeTitle}
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Save your favourite looks and revisit them anytime.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
            >
              Back to Profile
            </button>
            <button
              type="button"
              onClick={() => navigate("/style-discovery")}
              className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-400"
            >
              Discover More Styles
            </button>
          </div>
        </header>

        <div className="rounded-[32px] border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-white/70">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white/70" />
              <p>Loading your saved outfits...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-white/75">
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchWardrobe}
                className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-400"
              >
                Try Again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-white/70">
              <p>Your wardrobe is empty. Save outfits you love to see them here.</p>
              <button
                type="button"
                onClick={() => navigate("/curated")}
                className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-400"
              >
                View Curated Looks
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#181c24]"
                >
                  <img
                    src={item.image}
                    alt="Saved outfit"
                    className="h-64 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="flex flex-col gap-4 p-5">
                    {/* Delete button */}
                    <button
                      onClick={() => requestDelete(item)}
                      className="mt-2 rounded-full bg-red-500 px-3 py-1 text-sm text-white transition hover:bg-red-400 disabled:opacity-50"
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`fixed bottom-6 right-6 z-40 w-full max-w-xs rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
            actionFeedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#181c24] p-6 text-white shadow-2xl">
            <h2 className="text-lg font-semibold">Remove outfit?</h2>
            <p className="mt-2 text-sm text-white/70">
              This will permanently remove this look from your wardrobe.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
