"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to sign in.");
      router.replace("/");
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to sign in."); } finally { setBusy(false); }
  }

  return <main className="login-shell"><div className="login-panel"><div className="brand-lockup login-brand"><div className="brand-logo-frame"><Image className="brand-logo" src="/velmayil-ventures-logo-pdf.png" width={264} height={108} alt="Velmayil Ventures logo" priority /></div></div><span className="eyebrow">VELMAYIL VENTURES BILLING</span><h1>Welcome back</h1><p>Sign in to manage invoices, inventory, and receivables.</p><form onSubmit={submit} className="login-form"><label className="field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required /></label>{error && <div className="login-error">{error}</div>}<button className="button primary login-button" disabled={busy}>{busy ? "Signing in..." : "Sign in"}<span>→</span></button></form><small>Access is protected with server-side roles and secure sessions.</small></div><div className="login-art"><div className="login-art-card"><span>FINANCE CONTROL</span><strong>GST-ready billing</strong><div className="mini-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></div></main>;
}
