import type { GithubInlineThread } from './inlineThreads.js';
import { GithubComment } from './GithubComment.js';
import { GithubThreadActions } from './GithubThreadActions.js';

export function GithubThreadCard({ inline }: { inline: GithubInlineThread }) {
  const { thread, prUrl, path } = inline;
  return (
    <article
      aria-label="GitHub thread in code"
      className="mx-2 my-1 rounded-md border border-accent bg-card font-sans text-xs"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1">
        <strong className="mr-auto">GitHub thread</strong>
        {thread.isResolved && <span className="text-add">Resolved</span>}
        {thread.isOutdated && <span className="text-warn">Outdated</span>}
      </div>
      <div className="max-h-64 divide-y divide-border overflow-auto">
        {thread.comments.map((message) => (
          <GithubComment key={message.id} message={message} prUrl={prUrl} path={path} />
        ))}
      </div>
      <GithubThreadActions key={thread.id} prUrl={prUrl} thread={thread} />
    </article>
  );
}
