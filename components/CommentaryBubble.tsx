"use client";

import { useState } from "react";
import { COMMENTARY } from "@/lib/commentary";

// Internal/mockup "director's commentary": a fixed bottom-right avatar that
// toggles a speech bubble with Halle's note for the current step. UI only.
// Lives inside the flow pages, not anything client-facing.
export default function CommentaryBubble({ noteKey }: { noteKey: string }) {
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  const note = (COMMENTARY[noteKey] ?? "").trim();
  const hasNote = note.length > 0;

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      <style>{`@keyframes commentaryPulse{0%{box-shadow:0 0 0 0 rgba(224,121,27,.55)}70%{box-shadow:0 0 0 8px rgba(224,121,27,0)}100%{box-shadow:0 0 0 0 rgba(224,121,27,0)}}`}</style>

      {/* Speech bubble — opens up/left from the avatar */}
      {open && (
        <div
          role="dialog"
          aria-label="Director's commentary"
          style={{
            maxWidth: 280,
            background: "var(--panel, #fff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            padding: 12,
            position: "relative",
          }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
          <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
            Director&apos;s commentary
          </div>
          {hasNote ? (
            <div className="small" style={{ whiteSpace: "pre-wrap", paddingRight: 14 }}>{note}</div>
          ) : (
            <div className="small muted" style={{ fontStyle: "italic", paddingRight: 14 }}>No note yet for this step.</div>
          )}
        </div>
      )}

      {/* Avatar toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Director's commentary"
        title="Director's commentary"
        style={{
          position: "relative",
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "2px solid #fff",
          boxShadow: "0 2px 8px rgba(0,0,0,.25)",
          padding: 0,
          cursor: "pointer",
          overflow: "hidden",
          background: "var(--accent, #2563eb)",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/commentary-avatar.jpg"
            alt=""
            width={48}
            height={48}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={() => setImgOk(false)}
          />
        ) : (
          <span style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>HD</span>
        )}
        {/* Pulse/dot only when this step actually has a note to read */}
        {hasNote && !open && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#e0791b",
              border: "2px solid #fff",
              animation: "commentaryPulse 1.8s infinite",
            }}
          />
        )}
      </button>
    </div>
  );
}
