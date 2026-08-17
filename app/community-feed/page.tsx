import { DashboardShell } from "@/components/DashboardShell";
import { Heart, MessageCircle } from "lucide-react";

const posts = [
  {
    author: "Alex M.",
    time: "2h ago",
    content:
      "Stuck to my pre-trade checklist today — passed on 3 FOMO setups and only took the A+ entry. Discipline pays.",
    likes: 24,
    comments: 8,
  },
  {
    author: "Jordan K.",
    time: "5h ago",
    content:
      "New journal template is helping me spot my revenge trading pattern. Lost 2R yesterday, won 1R today by stopping early.",
    likes: 18,
    comments: 5,
  },
  {
    author: "Sam R.",
    time: "1d ago",
    content:
      "Weekly review tip: tag every trade with your emotional state at entry. Game changer for identifying tilt.",
    likes: 42,
    comments: 12,
  },
];

export default function CommunityFeedPage() {
  return (
    <DashboardShell
      title="Community Feed"
      description="Share insights and learn from fellow traders"
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {posts.map((post) => (
          <article
            key={post.content}
            className="rounded-xl border border-border bg-surface-raised p-5 transition-colors hover:border-border/80"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-sm font-semibold text-white">
                {post.author.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{post.author}</p>
                <p className="text-xs text-zinc-500">{post.time}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-zinc-300">
              {post.content}
            </p>

            <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
              <button className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-red-400">
                <Heart className="h-4 w-4" />
                {post.likes}
              </button>
              <button className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-accent-hover">
                <MessageCircle className="h-4 w-4" />
                {post.comments}
              </button>
            </div>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
