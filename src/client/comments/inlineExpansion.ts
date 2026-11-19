import { create } from 'zustand';
import type { CommentThread, GithubCommentThread } from '@/shared/protocol.js';

const initial = new Set<string>();
export const useInlineExpansion = create<{ expanded: ReadonlySet<string> }>(() => ({ expanded: initial }));

export function setInlineExpanded(key: string, open: boolean): void {
  useInlineExpansion.setState(({ expanded }) => {
    if (expanded.has(key) === open) return { expanded };
    const next = new Set(expanded);
    if (open) next.add(key);
    else next.delete(key);
    return { expanded: next };
  });
}

export function resetInlineExpansion(): void {
  useInlineExpansion.setState({ expanded: initial });
}

export const localThreadKey = (id: string) => `local:${id}`;
export const githubThreadKey = (id: string) => `github:${id}`;
export const localThreadStatus = (thread: CommentThread) =>
  thread.stale ? 'stale' : thread.resolved ? 'resolved' : null;
export const githubThreadStatus = (thread: GithubCommentThread) =>
  thread.isOutdated ? 'outdated' : thread.isResolved ? 'resolved' : null;
