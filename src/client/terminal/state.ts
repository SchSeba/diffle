import { create } from 'zustand';
import { MAX_TERMINALS, type TerminalAccess } from '@/shared/protocol.js';

interface Pane {
  id: number;
  startup?: number;
}

interface Tab {
  id: number;
  panes: Pane[];
  activePane: number;
}

interface TerminalLayout {
  token?: string;
  open: boolean;
  next: number;
  active?: number;
  tabs: Tab[];
  focusRequest: number;
}

export const useTerminalLayout = create<TerminalLayout>(() => ({ open: false, next: 1, tabs: [], focusRequest: 0 }));

function makeTab(id: number, startup?: number): Tab {
  return { id, panes: [{ id, startup }], activePane: id };
}

export function configureTerminals({ token, startupTabs }: TerminalAccess): void {
  if (useTerminalLayout.getState().token === token) return;
  const tabs = Array.from({ length: startupTabs }, (_, index) => makeTab(index + 1, index));
  useTerminalLayout.setState({ token, tabs, active: tabs[0]?.id, next: tabs.length + 1, open: tabs.length > 0 });
}

export function hasTerminalRoom(tabs: Tab[]): boolean {
  return tabs.reduce((count, tab) => count + tab.panes.length, 0) < MAX_TERMINALS;
}

export function addTerminal(): void {
  useTerminalLayout.setState((s) =>
    hasTerminalRoom(s.tabs) ? { next: s.next + 1, tabs: [...s.tabs, makeTab(s.next)], active: s.next } : s,
  );
}

export function selectTerminal(id: number): void {
  useTerminalLayout.setState((s) => ({ active: id, focusRequest: s.focusRequest + 1 }));
}

export function closeTerminal(id: number): void {
  useTerminalLayout.setState(({ active, tabs }) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const remaining = tabs.filter((tab) => tab.id !== id);
    return { tabs: remaining, active: id === active ? (remaining[index] ?? remaining.at(-1))?.id : active };
  });
}

export function splitTerminal(): void {
  useTerminalLayout.setState((s) => {
    if (!hasTerminalRoom(s.tabs)) return s;
    return {
      next: s.next + 1,
      tabs: s.tabs.map((tab) => {
        if (tab.id !== s.active) return tab;
        const at = tab.panes.findIndex((pane) => pane.id === tab.activePane) + 1;
        const panes = [...tab.panes];
        panes.splice(at, 0, { id: s.next });
        return { ...tab, panes, activePane: s.next };
      }),
    };
  });
}

export function closeTerminalPane(): void {
  useTerminalLayout.setState((s) => ({
    tabs: s.tabs.map((tab) => {
      if (tab.id !== s.active || tab.panes.length < 2) return tab;
      const at = tab.panes.findIndex((pane) => pane.id === tab.activePane);
      const panes = tab.panes.filter((pane) => pane.id !== tab.activePane);
      return { ...tab, panes, activePane: (panes[at] ?? panes.at(-1))!.id };
    }),
  }));
}

export function selectTerminalPane(id: number): void {
  useTerminalLayout.setState((s) => {
    const tab = s.tabs.find((tab) => tab.id === s.active);
    if (!tab || tab.activePane === id || !tab.panes.some((pane) => pane.id === id)) return s;
    return { tabs: s.tabs.map((entry) => (entry === tab ? { ...tab, activePane: id } : entry)) };
  });
}

function focusCurrentTerminal(): void {
  if (useTerminalLayout.getState().tabs.length === 0) addTerminal();
  useTerminalLayout.setState((s) => ({ open: true, focusRequest: s.focusRequest + 1 }));
}

export function moveTerminalFocus(code: string): boolean {
  const { token, tabs, active, open, focusRequest } = useTerminalLayout.getState();
  if (code === 'KeyG' && token) {
    focusCurrentTerminal();
    return true;
  }
  if (!open) return false;
  const index = tabs.findIndex((tab) => tab.id === active);
  const tab = tabs[index];
  if (!tab) return false;
  if (code === 'KeyJ' || code === 'KeyK') {
    selectTerminal(tabs[(index + (code === 'KeyJ' ? 1 : -1) + tabs.length) % tabs.length]!.id);
    return true;
  }
  if (code === 'KeyH' || code === 'KeyL') {
    const current = tab.panes.findIndex((pane) => pane.id === tab.activePane);
    const neighbor = tab.panes[current + (code === 'KeyL' ? 1 : -1)];
    if (neighbor) selectTerminalPane(neighbor.id);
    useTerminalLayout.setState({ focusRequest: focusRequest + 1 });
    return true;
  }
  return false;
}

export function toggleTerminal(): void {
  const { token, open } = useTerminalLayout.getState();
  if (!token) return;
  if (!open) {
    focusCurrentTerminal();
    return;
  }
  useTerminalLayout.setState({ open: false });
  document.querySelector<HTMLButtonElement>('[data-terminal-toggle]')?.focus();
}
