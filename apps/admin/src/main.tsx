import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "./style.css";

const API = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";
const ALLOW_DEV = (import.meta.env.VITE_ALLOW_DEV_AUTH as string | undefined) === "true";

type QueueItem = {
  poll: { id: string; question: string; author: { handle: string } };
  status: string;
  open_reports: number;
  moderation: { categories?: Record<string, boolean>; scores?: Record<string, number>; source?: string } | null;
  reporters: { reporter_handle: string; reason: string; detail?: string }[];
};

type Metrics = { users: number; polls_live: number; polls_pending: number; votes: number; open_reports: number };
type Activity = { kind: string; label: string; created_at: string };

async function req<T>(path: string, token: string, method = "GET"): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "X-Device-Id": "admin-console-device" },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || response.statusText);
  return response.json();
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("pollscale.admin") || "");
  const [email, setEmail] = useState("dave@polescale.com");
  const [handle, setHandle] = useState("daven");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  const load = async (jwt: string) => {
    const [q, m, a] = await Promise.all([
      req<QueueItem[]>("/admin/queue", jwt),
      req<Metrics>("/admin/metrics", jwt),
      req<Activity[]>("/admin/activity", jwt),
    ]);
    setQueue(q);
    setMetrics(m);
    setActivity(a);
  };

  useEffect(() => {
    if (!token) return;
    load(token).catch((err: Error) => {
      setError(err.message);
      if (err.message === "admin_required" || err.message === "unknown user") {
        localStorage.removeItem("pollscale.admin");
        setToken("");
      }
    });
  }, [token]);

  const signIn = async () => {
    setError("");
    if (!ALLOW_DEV) {
      setError("Set VITE_ALLOW_DEV_AUTH=true for local admin, or sign in with the app identity.");
      return;
    }
    const response = await fetch(`${API}/auth/dev`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Id": "admin-console-device" },
      body: JSON.stringify({ display_name: "Dave", handle, email }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.detail || "sign_in_failed");
      return;
    }
    if (!payload.user?.is_admin) {
      setError("That account is not on ADMIN_EMAILS.");
      return;
    }
    localStorage.setItem("pollscale.admin", payload.access_token);
    setToken(payload.access_token);
  };

  const act = async (id: string, action: "approve" | "reject") => {
    await req(`/admin/polls/${id}/${action}`, token, "POST");
    await load(token);
  };

  if (!token) {
    return (
      <div className="wrap">
        <p className="brand">Pollscale admin</p>
        <p className="meta">Same Apple/Google identity as the app. Locally, only if ALLOW_DEV_AUTH is on.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin email" />
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="username" />
        <button className="btn yes" onClick={signIn}>
          Continue (dev)
        </button>
        {error ? <p className="err">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="wrap">
      <p className="brand">Queue</p>
      <div className="grid">
        <section>
          {queue.length === 0 ? <p className="meta">Nothing waiting.</p> : null}
          {queue.map((item) => (
            <article className="card" key={item.poll.id}>
              <p className="q">{item.poll.question}</p>
              <p className="meta">
                @{item.poll.author.handle} · {item.status} · {item.open_reports} reports
              </p>
              <div className="scores">
                {item.moderation
                  ? `${item.moderation.source ?? "ai"}\n${JSON.stringify(item.moderation.categories || {}, null, 0)}\n${JSON.stringify(item.moderation.scores || {}, null, 0)}`
                  : "No AI scores"}
              </div>
              {item.reporters.map((report, index) => (
                <p className="meta" key={index}>
                  {report.reporter_handle}: {report.reason}
                  {report.detail ? ` — ${report.detail}` : ""}
                </p>
              ))}
              <div className="row">
                <button className="btn yes" onClick={() => act(item.poll.id, "approve")}>
                  Approve
                </button>
                <button className="btn no" onClick={() => act(item.poll.id, "reject")}>
                  Reject / takedown
                </button>
              </div>
            </article>
          ))}
        </section>
        <aside>
          {metrics ? (
            <div className="metrics">
              <div className="metric"><b>{metrics.polls_pending}</b>pending</div>
              <div className="metric"><b>{metrics.open_reports}</b>reports</div>
              <div className="metric"><b>{metrics.polls_live}</b>live</div>
              <div className="metric"><b>{metrics.users}</b>users</div>
              <div className="metric"><b>{metrics.votes}</b>votes</div>
            </div>
          ) : null}
          <h3>Activity</h3>
          {activity.map((row, index) => (
            <p className="meta" key={index}>
              {row.kind}: {row.label}
            </p>
          ))}
        </aside>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
