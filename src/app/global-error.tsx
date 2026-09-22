"use client";

/**
 * Last resort: catches a failure in the root layout itself, where the normal
 * error boundary has nothing left to render into. It therefore carries its own
 * html and body, and no shared component.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#faf8f5",
          color: "#2b2724",
          margin: 0,
          padding: "1rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Oummi RH est momentanément indisponible</h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.5 }}>
            Réessayez dans un instant. Si le problème persiste, prévenez la direction.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: "3rem",
              padding: "0 1.5rem",
              fontSize: "1rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#2b2724",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
              Référence : {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
