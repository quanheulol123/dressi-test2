import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, LogIn, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type EarlyAccessEntry = {
  id: string;
  email: string;
  consent: boolean;
  created_at?: string | null;
};

const PAGE_SIZE = 20;

function formatDate(value?: string | null): string {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildAuthHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entries, setEntries] = useState<EarlyAccessEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const isAdmin = user?.isAdmin === true;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / PAGE_SIZE)),
    [total],
  );

  const paginationSummary = useMemo(() => {
    if (!entries.length) {
      return total
        ? "No registrations on this page."
        : "No early-access registrations captured yet.";
    }
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = start + entries.length - 1;
    return `Showing ${start} to ${end} of ${total}`;
  }, [entries.length, page, total]);

  useEffect(() => {
    if (!isAdmin) {
      setEntries([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchEntries() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          apiUrl(`/api/early_access/list/?page=${page}&page_size=${PAGE_SIZE}`),
          {
            headers: buildAuthHeaders(user?.token),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const detail: string | undefined =
            typeof payload?.detail === "string" ? payload.detail : undefined;
          throw new Error(detail || "Unable to load registrations.");
        }

        const payload = (await response.json()) as {
          items?: EarlyAccessEntry[];
          total?: number;
          page?: number;
          page_size?: number;
        };

        if (cancelled) return;

        const nextTotal = typeof payload.total === "number" ? payload.total : 0;
        const nextTotalPages = Math.max(
          1,
          Math.ceil((nextTotal || 0) / PAGE_SIZE),
        );

        setEntries(Array.isArray(payload.items) ? payload.items : []);
        setTotal(nextTotal);

        if (nextTotal && page > nextTotalPages) {
          setPage(nextTotalPages);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unable to load registrations.";
        setError(message);
        setEntries([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchEntries();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user?.token, page, isAdmin]);

  const handleExport = async () => {
    if (!isAdmin || exporting) return;

    setExportError(null);
    setExporting(true);
    try {
      const response = await fetch(
        apiUrl("/api/early_access/export/"),
        {
          headers: buildAuthHeaders(user?.token),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const detail: string | undefined =
          typeof payload?.detail === "string" ? payload.detail : undefined;
        throw new Error(detail || "Export failed. Please try again.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `early-access-${timestamp}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Export failed. Please try again.";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  if (!user) {
    return (
      <section className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#04030f] px-6 py-12 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_40px_120px_rgba(6,5,15,0.45)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/30">
            <LogIn className="h-8 w-8 text-pink-200" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold">Admin access only</h1>
          <p className="mt-2 text-sm text-white/70">
            Sign in with the administrator account to view early-access
            registrations.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Go to login
          </Link>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#04030f] px-6 py-12 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-rose-500/10 p-10 text-center shadow-[0_40px_120px_rgba(80,10,40,0.45)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/30">
            <ShieldAlert className="h-8 w-8 text-rose-100" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-white/70">
            You are signed in, but this area is restricted to the administrator
            account.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-[#04030f] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(6,5,15,0.4)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Early-access registrations
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Monitor signups collected from the early-access modal. Data
              refreshes automatically for the current page.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-white/40">
              Total registrations: {total}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !total}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export to Excel
          </button>
        </header>

        {exportError ? (
          <p className="mt-4 text-sm text-rose-300">{exportError}</p>
        ) : null}
        {error ? (
          <p className="mt-6 text-sm text-rose-300">{error}</p>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(6,5,15,0.35)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/50">
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Consent</th>
                  <th className="px-6 py-4 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-10 text-center text-sm text-white/70"
                    >
                      {loading
                        ? "Loading registrations..."
                        : "No registrations found for this page."}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 font-medium">{entry.email}</td>
                      <td className="px-6 py-4 text-white/70">
                        {entry.consent ? "Yes" : "No"}
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {formatDate(entry.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 border-t border-white/10 px-6 py-4 text-sm text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing...
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-4 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>{paginationSummary}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || loading}
              className="rounded-full border border-white/20 px-4 py-2 font-medium text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <span className="text-white/60">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-full border border-white/20 px-4 py-2 font-medium text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
