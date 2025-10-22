import { memo, useEffect, useState } from "react";
import { X, Crown } from "lucide-react";
import { apiUrl } from "../lib/api";

const EarlyAccessModal = memo(function EarlyAccessModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setEmail("");
      setSubmitted(false);
      setError("");
      setLoading(false);
      setServerMessage("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setServerMessage("");

    if (!email.match(/^[^@]+@[^@]+\.[^@]+$/)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/early_access/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, consent: true }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status !== "ok") {
        const message =
          typeof data?.message === "string" && data.message.trim().length > 0
            ? data.message
            : "We couldn't save that email right now. Please try again.";
        throw new Error(message);
      }

      setServerMessage(
        typeof data.message === "string" && data.message.trim().length > 0
          ? data.message
          : "Thanks! You're on the early access list."
      );
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-black"
          onClick={onClose}
          aria-label="Close early access signup"
        >
          <X size={24} />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="text-yellow-500" size={28} />
          <span className="font-bold text-lg text-black">Get Early Access</span>
        </div>
        <h2 className="text-2xl font-extrabold mb-2 text-pink-500">
          Be the First to Try Dressi Mobile!
        </h2>
        <p className="text-gray-700 mb-6">
          Enter your email to join the exclusive waitlist for our upcoming mobile app. We'll
          notify you as soon as it's ready!
        </p>
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-green-600 font-semibold">
              {serverMessage || "Thanks! You're on the early access list."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-400"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              className="border border-gray-300 rounded-lg px-4 py-2 text-black"
              placeholder="Your email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="bg-pink-500 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-pink-600 transition disabled:opacity-60"
            >
              {loading ? "Joining..." : "Join Early Access"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
});

export default EarlyAccessModal;
