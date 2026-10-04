"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en-IN"><body style={{ margin: 0, fontFamily: "Arial, Helvetica, sans-serif", background: "#f7f6f3", color: "#102b47" }}><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><section style={{ maxWidth: 480, padding: 32, border: "1px solid #e3e0da", borderRadius: 15, background: "#fffdfb", textAlign: "center" }}><p style={{ color: "#b04a5a", fontWeight: 700 }}>VELMAYIL VENTURES BILLING</p><h1>Something went wrong</h1><p style={{ color: "#6d7682", lineHeight: 1.5 }}>The workspace could not complete this screen safely. Try again, and contact an administrator if the problem continues.</p><button onClick={() => reset()} style={{ border: 0, borderRadius: 8, padding: "11px 16px", color: "white", background: "#0d3b66", cursor: "pointer", fontWeight: 700 }}>Try again</button></section></main></body></html>;
}
