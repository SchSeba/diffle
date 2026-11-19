import { ChevronDown, Plus, Terminal, X } from 'lucide-react';
import { useEffect, useState, type PointerEvent } from 'react';
import { terminalAccess } from '@/client/api.js';
import { Button } from '@/client/ui/Button.js';
import { addTerminal, closeTerminal, toggleTerminal, useTerminalLayout } from './state.js';
import { TerminalSurface } from './TerminalSurface.js';

export function TerminalToggle() {
  const token = useTerminalLayout((s) => s.token);
  const open = useTerminalLayout((s) => s.open);

  useEffect(() => {
    const controller = new AbortController();
    void terminalAccess(controller.signal).then(
      (token) => {
        if (!controller.signal.aborted) useTerminalLayout.setState({ token });
      },
      () => {},
    );
    return () => controller.abort();
  }, []);

  if (!token) return null;
  return (
    <Button
      variant="ghost"
      icon
      data-terminal-toggle
      aria-label="Terminal"
      aria-expanded={open}
      aria-controls="terminal-panel"
      title="Toggle terminal (Ctrl+`)"
      onClick={toggleTerminal}
    >
      <Terminal size="1rem" />
    </Button>
  );
}

function clampHeight(height: number): number {
  return Math.min(Math.max(120, height), Math.round(window.innerHeight * 0.75));
}

export function TerminalPanel() {
  const { token, tabs, open, active } = useTerminalLayout();
  const [height, setHeight] = useState(264);
  if (!token || (!open && !tabs.length)) return null;

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      setHeight(clampHeight(window.innerHeight - event.clientY));
  };

  return (
    <section
      id="terminal-panel"
      aria-label="Terminal panel"
      className={open ? 'col-span-full flex min-h-0 flex-col border-t border-border bg-canvas' : 'hidden'}
      style={{ height: `min(${height}px, 75vh)` }}
    >
      <div
        className="group flex h-1.5 shrink-0 cursor-row-resize items-center justify-center bg-surface"
        onPointerDown={startResize}
        onPointerMove={resize}
      >
        <span className="h-0.5 w-8 rounded-full bg-border group-hover:bg-accent" />
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-2 pb-1.5 text-xs">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tabs.map((id) => (
            <div
              key={id}
              data-active={id === active}
              className="flex shrink-0 items-center rounded-md border border-transparent text-muted data-[active=true]:border-border data-[active=true]:bg-card data-[active=true]:text-foreground"
            >
              <Button
                variant="ghost"
                aria-pressed={id === active}
                onClick={() => useTerminalLayout.setState({ active: id })}
              >
                <Terminal size="0.8125rem" />
                Terminal {id}
              </Button>
              <Button variant="ghost" icon aria-label={`Close terminal ${id}`} onClick={() => closeTerminal(id)}>
                <X size="0.8rem" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" icon aria-label="New terminal" onClick={addTerminal}>
          <Plus size="1rem" />
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" icon aria-label="Hide terminal panel" onClick={toggleTerminal}>
          <ChevronDown size="1rem" />
        </Button>
      </div>
      {tabs.map((id) => (
        <div key={id} className={id === active ? 'flex min-h-0 flex-1' : 'hidden'} inert={!open || id !== active}>
          <TerminalSurface token={token} active={open && id === active} />
        </div>
      ))}
    </section>
  );
}
