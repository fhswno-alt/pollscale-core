"use client";

import { useEffect, useState } from "react";

import { API, req } from "@/lib/api";

type QueueItem = {
  poll: { id: string; question: string; author: { handle: string } };
  status: string;
  open_reports: number;
  moderation: { categories?: Record<string, boolean>; scores?: Record<string, number>; source?: string } | null;
  reporters: { reporter_handle: string; reason: string; detail?: string }[];
};

type Metrics = { users: number; polls_live: number; polls_pending: number; votes: number; open_reports: number };
type Activity = { kind: string; label: string; created_at: string };
type AdminRow = { id: string; email: string; totp_enrolled: boolean };

type LoginPayload = {
  status: "enroll_mfa" | "mfa_required";
  enrollment_token?: string | null;
  mfa_token?: string | null;
  otpauth_url?: string | null;
  secret?: string | null;
  qr_png_base64?: string | null;
};

export function AdminConsole() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("dave@pollscale.com");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<LoginPayload | null>(null);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = async (jwt: string) => {
    const [q, m, a, people] = await Promise.all([
      req<QueueItem[]>("/admin/queue", jwt),
      req<Metrics>("/admin/metrics", jwt),
      req<Activity[]>("/admin/activity", jwt),
      req<AdminRow[]>("/admin/users", jwt),
    ]);
    setQueue(q);
    setMetrics(m);
    setActivity(a);
    setAdmins(people);
  };

  useEffect(() => {
    const stored = localStorage.getItem("pollscale.admin") || "";
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((err: Error) => {
      setError(err.message);
      if (err.message === "admin_required" || err.message === "unknown user" || err.message === "invalid token") {
        localStorage.removeItem("pollscale.admin");
        setToken("");
      }
    });
  }, [token]);

  const signIn = async () => {
    setError("");
    const response = await fetch(`${API}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json()) as LoginPayload & { detail?: string; access_token?: string };
    if (!response.ok) {
      setError(payload.detail || "sign_in_failed");
      return;
    }
    if (payload.access_token) {
      setError("Password-only login is not allowed.");
      return;
    }
    setPending(payload);
    setCode("");
  };

  const confirmMfa = async () => {
    if (!pending) return;
    setError("");
    const ticket = pending.enrollment_token || pending.mfa_token;
    const response = await fetch(`${API}/admin/auth/mfa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ticket, code }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.detail || "invalid_code");
      return;
    }
    localStorage.setItem("pollscale.admin", payload.access_token);
    setToken(payload.access_token);
    setPending(null);
    setPassword("");
    setCode("");
  };

  const act = async (id: string, action: "approve" | "reject") => {
    await req(`/admin/polls/${id}/${action}`, token, "POST");
    await load(token);
  };

  const addAdmin = async () => {
    setError("");
    try {
      await req("/admin/users", token, "POST", { email: newEmail, password: newPassword });
      setNewEmail("");
      setNewPassword("");
      await load(token);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!token) {
    return (
      <div className="wrap">
        <p className="brand">Pollscale admin</p>
        <p className="meta">Email and password on this console only. Then a TOTP app (Microsoft, Google, or any authenticator).</p>
        {!pending ? (
          <>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin email" autoComplete="username" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type="password"
              autoComplete="current-password"
            />
            <button className="btn yes" onClick={signIn}>
              Continue
            </button>
          </>
        ) : (
          <>
            {pending.status === "enroll_mfa" ? (
              <>
                <p className="meta">Scan the QR or type the secret into your authenticator, then enter the 6-digit code.</p>
                {pending.qr_png_base64 ? (
                  // QR is a data URL from FastAPI; next/image is not useful here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="TOTP QR"
                    src={`data:image/png;base64,${pending.qr_png_base64}`}
                    style={{ width: 180, height: 180, background: "#fff", padding: 8, borderRadius: 12 }}
                  />
                ) : null}
                {pending.secret ? <p className="meta">Secret: {pending.secret}</p> : null}
              </>
            ) : (
              <p className="meta">Enter the 6-digit code from your authenticator.</p>
            )}
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" />
            <button className="btn yes" onClick={confirmMfa}>
              Verify
            </button>
          </>
        )}
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
          <h3>Admins</h3>
          {admins.map((row) => (
            <p className="meta" key={row.id}>
              {row.email}
              {row.totp_enrolled ? "" : " · enroll MFA"}
            </p>
          ))}
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new admin email" />
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="password (10+)"
            type="password"
          />
          <button className="btn no" onClick={addAdmin}>
            Add admin
          </button>
          {error ? <p className="err">{error}</p> : null}
          <button
            className="btn no"
            onClick={() => {
              localStorage.removeItem("pollscale.admin");
              setToken("");
            }}
          >
            Sign out
          </button>
        </aside>
      </div>
    </div>
  );
}
