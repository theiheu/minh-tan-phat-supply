"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { ExternalLink, Check, Copy, ArrowRight, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIMarkdownProps {
  content: string;
}

export function AIMarkdown({ content }: AIMarkdownProps) {
  return (
    <div className="ai-markdown prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Header formatting
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-foreground mt-2 mb-1.5 border-b pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold text-foreground mt-2 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold text-foreground/90 mt-1.5 mb-0.5 uppercase tracking-wide">
              {children}
            </h3>
          ),

          // Paragraphs & emphasis
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-normal">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground underline-offset-2">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 mb-2 text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 mb-2 text-foreground/90 font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-normal">{children}</li>,

          // Tables
          table: ({ children }) => (
            <div className="my-2.5 w-full overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/80 text-muted-foreground border-b uppercase text-[10px] font-semibold tracking-wider">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-foreground/90 border-r border-border/50 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-border/50 border-r border-border/50 last:border-r-0 last:border-b-0 leading-tight">
              {children}
            </td>
          ),

          // Blockquotes for notes and SOP tips
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-3 border-primary/60 bg-muted/40 px-3 py-1.5 rounded-r text-xs text-muted-foreground italic">
              {children}
            </blockquote>
          ),

          // Code blocks & inline code
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-primary font-medium border border-border/60"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock code={String(children).replace(/\n$/, "")} />;
          },

          // Links & Action Buttons
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;

            // Nếu là link tạo phiếu cấp phát
            if (href.startsWith("/requisitions/new") || href.includes("requisitions")) {
              return (
                <Link
                  href={href}
                  className="inline-flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 my-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-2xs"
                >
                  <FilePlus2 className="size-3.5" />
                  <span>{children || "Tạo phiếu yêu cầu ngay"}</span>
                  <ArrowRight className="size-3" />
                </Link>
              );
            }

            const isExternal = href.startsWith("http://") || href.startsWith("https://");
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
              >
                {children}
                {isExternal && <ExternalLink className="size-3 inline opacity-70" />}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-lg border bg-muted/60 p-2.5 font-mono text-xs text-foreground overflow-x-auto group">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 size-6 opacity-0 group-hover:opacity-100 transition bg-background/80 hover:bg-background"
        title="Sao chép"
      >
        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
      </Button>
      <pre className="m-0 overflow-x-auto whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
