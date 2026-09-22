import { Fragment, type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`b-${key}`} className="font-semibold text-zinc-50">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={`i-${key}`} className="italic text-zinc-200">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`c-${key}`}
          className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-indigo-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <a
            key={`a-${key}`}
            href={link[2]}
            className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:text-indigo-200"
            target="_blank"
            rel="noreferrer"
          >
            {link[1]}
          </a>
        );
      }
    }
    key += 1;
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function parseBlocks(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push(
        <pre
          key={`pre-${key}`}
          className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-zinc-200"
        >
          {lang ? (
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              {lang}
            </div>
          ) : null}
          <code>{code.join("\n")}</code>
        </pre>
      );
      key += 1;
      i += 1;
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.startsWith("###") ? 3 : line.startsWith("##") ? 2 : 1;
      const text = line.replace(/^#{1,3}\s/, "");
      const className =
        level === 1
          ? "text-base font-semibold text-zinc-50"
          : "text-sm font-semibold text-zinc-100";
      blocks.push(
        <p key={`h-${key}`} className={className}>
          {renderInline(text)}
        </p>
      );
      key += 1;
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc space-y-1 pl-5 text-zinc-300">
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      key += 1;
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${key}`} className="list-decimal space-y-1 pl-5 text-zinc-300">
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      key += 1;
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```")) {
      if (/^\s*[-*]\s/.test(lines[i]) || /^\s*\d+\.\s/.test(lines[i]) || /^#{1,3}\s/.test(lines[i])) {
        break;
      }
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${key}`} className="text-zinc-300">
        {para.map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? <br /> : null}
            {renderInline(part)}
          </Fragment>
        ))}
      </p>
    );
    key += 1;
  }

  return blocks;
}

type MarkdownMessageProps = {
  content: string;
  streaming?: boolean;
};

export function MarkdownMessage({ content, streaming }: MarkdownMessageProps) {
  if (!content && streaming) {
    return (
      <span className="inline-flex h-4 w-1.5 animate-ai-caret rounded-sm bg-indigo-300" />
    );
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parseBlocks(content)}
      {streaming ? (
        <span className="ml-0.5 inline-flex h-4 w-1.5 animate-ai-caret rounded-sm bg-indigo-300 align-middle" />
      ) : null}
    </div>
  );
}
