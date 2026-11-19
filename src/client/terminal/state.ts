import { create } from 'zustand';

interface TerminalLayout {
  token?: string;
  open: boolean;
  next: number;
  active?: number;
  tabs: number[];
}

export const useTerminalLayout = create<TerminalLayout>(() => ({ open: false, next: 1, tabs: [] }));

export function addTerminal(): void {
  useTerminalLayout.setState(({ next, tabs }) => ({ next: next + 1, tabs: [...tabs, next], active: next }));
}

export function closeTerminal(id: number): void {
  useTerminalLayout.setState(({ active, tabs }) => {
    const index = tabs.indexOf(id);
    const remaining = tabs.filter((tab) => tab !== id);
    return { tabs: remaining, active: id === active ? (remaining[index] ?? remaining.at(-1)) : active };
  });
}

export function toggleTerminal(): void {
  const { token, open, tabs } = useTerminalLayout.getState();
  if (!token) return;
  if (!open && !tabs.length) addTerminal();
  useTerminalLayout.setState({ open: !open });
  if (open) document.querySelector<HTMLButtonElement>('[data-terminal-toggle]')?.focus();
}
