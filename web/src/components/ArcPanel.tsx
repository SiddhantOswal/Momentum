import type { Ref } from "react";

const SUGGESTIONS = ["New lot", "Check a defect", "Ask about the data", "Open a job card"];

function ArcMark({ size }: { size: number }) {
  return (
    <svg className="arc-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--ac)" />
      <path d="M6.8 21.6A9.2 9.2 0 0 1 22.2 14.6" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M17.6 21.4l3 3 5.6-6.4" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.8" cy="21.6" r="2.5" fill="currentColor" />
    </svg>
  );
}

function ArcGlyph({ path }: { path: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

export function ArcLauncher({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="arc-launcher" aria-label={open ? "Close Arc by Momentum" : "Open Arc by Momentum"}
      aria-haspopup="dialog" aria-controls="arc-panel" aria-expanded={open} onClick={onToggle}>
      <ArcMark size={30} />
      <span className="arc-launcher-copy"><strong>Arc</strong><span>Tell Arc what you need</span></span>
      <span className="arc-launcher-action">{open ? "Close" : "Open"}</span>
    </button>
  );
}

type ArcPanelProps = {
  ref?: Ref<HTMLDialogElement>;
  hostTitle: string;
  showHistory: boolean;
  onToggleHistory: () => void;
  onClose: () => void;
};

export function ArcPanel({ ref, hostTitle, showHistory, onToggleHistory, onClose }: ArcPanelProps) {
  return (
    <dialog ref={ref} id="arc-panel" className="arc-dialog" aria-label="Arc by Momentum" onClose={onClose}>
      <header className="arc-panel-header">
        <ArcMark size={36} />
        <div className="arc-panel-name"><strong>Arc</strong><span>by Momentum</span></div>
        <span className="arc-panel-host"><i aria-hidden="true" />{hostTitle}</span>
        <button type="button" className="arc-icon-button arc-history-button" aria-label="Past work"
          aria-pressed={showHistory} aria-controls="arc-activity" onClick={onToggleHistory}>
          <ArcGlyph path="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
        </button>
        <form method="dialog">
          <button type="submit" className="arc-icon-button" aria-label="Close Arc">
            <ArcGlyph path="M6 6l12 12M18 6L6 18" />
          </button>
        </form>
      </header>
      <div className="arc-panel-body">
        <h2 className="arc-panel-heading">{showHistory ? "Past work" : "What do you need done?"}</h2>
        <div id="arc-activity" role={showHistory ? "region" : "log"} aria-label={showHistory ? "Past work" : "Arc messages"}>
          <span className="arc-connection-state"><i aria-hidden="true" />Not connected</span>
        </div>
        {!showHistory && (
          <div className="arc-suggestions" role="group" aria-labelledby="arc-suggestions-title">
            <h3 id="arc-suggestions-title">Or start something</h3>
            {SUGGESTIONS.map(label => <button type="button" className="arc-suggestion" key={label} disabled>{label}</button>)}
          </div>
        )}
      </div>
      <footer className="arc-composer">
        <div className="arc-composer-box">
          <textarea rows={1} aria-label="Message Arc" placeholder="Tell Arc what you need" disabled />
          <button type="button" className="arc-icon-button" aria-label="Speak to Arc"
            aria-describedby="arc-voice-status" disabled>
            <ArcGlyph path="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4" />
          </button>
          <span id="arc-voice-status" className="sr-only">Voice input is unavailable.</span>
          <button type="button" className="arc-icon-button arc-send" aria-label="Send" disabled>
            <ArcGlyph path="M5 12h14M13 6l6 6-6 6" />
          </button>
        </div>
      </footer>
    </dialog>
  );
}
