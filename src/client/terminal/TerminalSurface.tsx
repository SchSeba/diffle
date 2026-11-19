import { useEffect, useRef, useState } from 'react';
import type { Terminal } from 'ghostty-web';
import { connectTerminal } from '@/client/api.js';
import { useRemPx } from '@/client/scale.js';
import { useStore } from '@/client/store.js';
import { TerminalResizeSchema, TerminalStatusSchema } from '@/shared/protocol.js';
import { loadTerminalFonts, terminalFont, terminalPalette } from './appearance.js';

const loadGhostty = async () => {
  const [lib, { default: wasmUrl }] = await Promise.all([
    import('ghostty-web'),
    import('ghostty-web/ghostty-vt.wasm?url'),
  ]);
  const ghostty = await lib.Ghostty.load(wasmUrl);
  return { lib, ghostty };
};
let loading: ReturnType<typeof loadGhostty> | undefined;

export function TerminalSurface({
  token,
  startup,
  active,
  focusRequest,
}: {
  token: string;
  startup?: number;
  active: boolean;
  focusRequest: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal>(null);
  const resizeTerminal = useRef<() => void>(null);
  const fontSize = useStore((s) => s.config.terminalFontSize);
  const rem = useRemPx();
  const savedSize = useRef(fontSize);
  const focused = useRef(active);
  const [status, setStatus] = useState('Starting shell…');

  useEffect(() => {
    savedSize.current = fontSize;
    resizeTerminal.current?.();
  }, [fontSize, rem]);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function start(host: HTMLDivElement) {
      loading ??= loadGhostty().catch((error: unknown) => {
        loading = undefined;
        throw error;
      });
      const [{ lib, ghostty }] = await Promise.all([loading, loadTerminalFonts()]);
      if (cancelled) return;
      const size = () => savedSize.current ?? Number.parseFloat(getComputedStyle(host).fontSize);
      const term = new lib.Terminal({
        ghostty,
        fontFamily: terminalFont,
        fontSize: size(),
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000,
        theme: terminalPalette(),
      });
      const fit = new lib.FitAddon();
      term.loadAddon(fit);
      term.open(host);
      terminal.current = term;
      const ws = connectTerminal(token, startup);
      cleanup = () => {
        ws.close();
        terminal.current = null;
        term.dispose();
      };
      const resize = () => {
        if (host.clientHeight === 0) return;
        term.options.fontSize = size();
        const dims = fit.proposeDimensions();
        if (!dims) return;
        term.resize(Math.min(500, dims.cols), Math.min(300, dims.rows));
      };
      resizeTerminal.current = resize;
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      const dispose = cleanup;
      cleanup = () => {
        resizeTerminal.current = null;
        observer.disconnect();
        dispose();
      };
      const sendSize = () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const size = TerminalResizeSchema.parse({ cols: term.cols, rows: term.rows });
        ws.send(JSON.stringify(size));
      };
      term.onResize(sendSize);
      const encoder = new TextEncoder();
      term.onData((data) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const bytes = encoder.encode(data);
        for (let offset = 0; offset < bytes.length; offset += 32 * 1024) {
          ws.send(bytes.subarray(offset, offset + 32 * 1024));
        }
      });
      ws.onopen = () => {
        sendSize();
        if (focused.current && host.offsetParent !== null && !host.closest('[inert]')) term.focus();
        setStatus('');
      };
      ws.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (data instanceof ArrayBuffer) term.write(new Uint8Array(data));
        else if (typeof data === 'string') {
          const result = TerminalStatusSchema.parse(JSON.parse(data));
          setStatus(result.error ?? `Shell exited${result.exitCode == null ? '' : ` (${result.exitCode})`}`);
        }
      };
      ws.onclose = () => {
        if (!cancelled) setStatus((current) => current || 'Terminal disconnected');
      };
      ws.onerror = () => setStatus('Terminal connection failed');
    }

    void start(host).catch((error: unknown) => {
      if (!cancelled) setStatus(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [token, startup]);

  useEffect(() => {
    focused.current = active;
    if (active) terminal.current?.focus();
  }, [active, focusRequest]);

  return (
    <div className="relative min-h-0 flex-1" data-terminal-input>
      <div ref={container} className="absolute inset-0 bg-canvas p-2 text-sm text-foreground" />
      {status && (
        <span className="pointer-events-none absolute right-3 bottom-2 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted shadow-sm">
          {status}
        </span>
      )}
    </div>
  );
}
