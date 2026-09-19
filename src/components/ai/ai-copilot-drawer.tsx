"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  X,
  ChevronRight,
  PackageSearch,
  Fuel,
  BookOpen,
  AlertTriangle,
  Wrench,
  Shield,
  Tag,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AIMarkdown } from "./ai-markdown";

interface AICopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ToolInvocationUI {
  toolName: string;
  result?: unknown;
}

interface QuickPromptItem {
  id?: string;
  label: string;
  prompt: string;
  icon: string;
}

const DEFAULT_PROMPTS: QuickPromptItem[] = [
  {
    icon: "PackageSearch",
    label: "Tồn kho động cơ & van bi",
    prompt: "Tra cứu tồn kho thực tế của động cơ điện và van bi ở các kho hiện tại.",
  },
  {
    icon: "AlertTriangle",
    label: "Vật tư sắp cạn kho",
    prompt: "Quét danh sách các vật tư đang có số lượng dưới mức tồn tối thiểu.",
  },
  {
    icon: "Fuel",
    label: "Báo cáo xăng dầu gần đây",
    prompt: "Tổng hợp các lần cấp phát xăng dầu gần đây nhất cho các xe và máy móc.",
  },
  {
    icon: "BookOpen",
    label: "Quy trình Đổi 1-1",
    prompt: "Hướng dẫn quy trình đổi 1-1 cấp tốc khi thiết bị hỏng tại trang trại.",
  },
];

function getIconComponent(iconName: string) {
  switch (iconName) {
    case "PackageSearch":
      return PackageSearch;
    case "AlertTriangle":
      return AlertTriangle;
    case "Fuel":
      return Fuel;
    case "BookOpen":
      return BookOpen;
    case "Wrench":
      return Wrench;
    case "Shield":
      return Shield;
    case "Tag":
      return Tag;
    default:
      return Sparkles;
  }
}

export function AICopilotDrawer({ open, onOpenChange }: AICopilotDrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [promptsList, setPromptsList] = React.useState<QuickPromptItem[]>(DEFAULT_PROMPTS);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
    // Tải danh sách quick prompts động từ database
    fetch("/api/ai/quick-prompts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.prompts && Array.isArray(data.prompts) && data.prompts.length > 0) {
          setPromptsList(data.prompts);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_PROMPTS
      });
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setMessages,
    setInput: _setInput,
    append,
  } = useChat({
    api: "/api/ai/chat",
    onError: (err) => {
      console.warn("[AI Copilot Warning]:", err.message);
      try {
        const parsed = JSON.parse(err.message);
        toast.error(parsed.error || "Không thể kết nối tới AI Copilot.");
      } catch {
        toast.error(err.message || "Không thể xử lý yêu cầu lúc này.");
      }
    },
  });

  // Tự động cuộn xuống dưới cùng khi có tin nhắn mới
  React.useEffect(() => {
    if (open && mounted) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
        inputRef.current?.focus?.();
      }, 100);
    }
  }, [messages, open, mounted]);

  // Phím tắt bàn phím Cmd+J / Ctrl+J
  React.useEffect(() => {
    if (!mounted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange, mounted]);

  const handleQuickPrompt = (promptText: string) => {
    append({
      role: "user",
      content: promptText,
    });
  };

  const handleClearHistory = () => {
    setMessages([]);
  };

  if (!mounted) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-lg md:max-w-2xl max-w-full overflow-hidden"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-sm sm:text-base font-semibold flex items-center gap-2 truncate">
                <span>MTP Farm Copilot</span>
                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 bg-primary/5 text-primary border-primary/20 shrink-0">
                  AI Local
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs truncate">
                Trợ lý báo cáo, tồn kho & quy trình trang trại
              </SheetDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={handleClearHistory}
                title="Xóa lịch sử cuộc trò chuyện"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Nội dung hội thoại */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-4 text-sm bg-muted/10">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center px-1">
              <div className="flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 shadow-inner">
                <Bot className="size-6 sm:size-7" />
              </div>
              <h3 className="font-semibold text-base mb-1 text-foreground">Tôi có thể giúp gì cho bạn?</h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-5 leading-relaxed">
                Hỏi đáp tồn kho thực tế, số liệu xăng dầu, tra cứu quy trình SOP hoặc tạo nháp phiếu cấp phát vật tư.
              </p>

              {/* Gợi ý nhanh động */}
              <div className="w-full max-w-md space-y-2 text-left">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Gợi ý tra cứu nhanh
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {promptsList.map((item, idx) => {
                    const Icon = getIconComponent(item.icon);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickPrompt(item.prompt)}
                        className="group flex items-start gap-3 w-full p-2.5 sm:p-3 rounded-xl border border-border/80 bg-card hover:bg-accent/60 hover:border-primary/40 text-left transition-all duration-200 shadow-2xs cursor-pointer min-w-0 overflow-hidden"
                      >
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5 border border-primary/20">
                          <Icon className="size-4" />
                        </div>

                        <div className="flex-1 min-w-0 pr-1">
                          <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mt-0.5 break-words">
                            {item.prompt}
                          </div>
                        </div>

                        <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-primary shrink-0 self-center transition-transform group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === "user";
              return isUser ? (
                <div key={m.id} className="flex flex-col items-end w-full space-y-1">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium pr-1">
                    <span>Bạn</span>
                    <User className="size-3 text-muted-foreground" />
                  </div>
                  <div className="rounded-2xl rounded-tr-xs px-3.5 py-2.5 sm:px-4 sm:py-2.5 max-w-[88%] sm:max-w-[82%] bg-primary text-primary-foreground text-sm font-medium shadow-xs leading-relaxed break-words">
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex flex-col items-start w-full space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground px-0.5">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/20">
                      <Bot className="size-3.5" />
                    </div>
                    <span>AI Copilot</span>
                  </div>

                  <div className="w-full rounded-2xl rounded-tl-xs px-3.5 py-2.5 sm:px-4 sm:py-3 bg-card border border-border text-foreground text-sm shadow-xs leading-relaxed min-w-0 overflow-hidden break-words">
                    {/* Hiển thị Tool Invocation nếu có */}
                    {((m.toolInvocations as unknown as ToolInvocationUI[]) || []).map((tool, idx: number) => {
                      const toolName = tool.toolName;
                      const isComplete = "result" in tool;

                      const getToolLabel = (name: string, done: boolean) => {
                        if (name === "get_stock_balance") return done ? "Đã tra cứu tồn kho" : "Đang tra cứu tồn kho...";
                        if (name === "get_fuel_dispense_report") return done ? "Đã lấy báo cáo xăng dầu" : "Đang lấy báo cáo xăng dầu...";
                        if (name === "search_sop_knowledge") return done ? "Đã tra cứu tài liệu quy trình" : "Đang tra cứu tài liệu quy trình...";
                        if (name === "get_low_stock_alerts") return done ? "Đã quét cảnh báo cạn kho" : "Đang quét cảnh báo cạn kho...";
                        if (name === "draft_requisition") return done ? "Đã lập nháp phiếu yêu cầu" : "Đang lập nháp phiếu yêu cầu...";
                        if (name === "search_catalog") return done ? "Đã tìm kiếm danh mục vật tư" : "Đang tìm kiếm danh mục vật tư...";
                        if (name === "get_vehicles_list") return done ? "Đã lấy danh sách xe & định mức" : "Đang lấy danh sách xe & định mức...";
                        if (name === "get_recent_requisitions") return done ? "Đã tra cứu phiếu cấp phát" : "Đang tra cứu phiếu cấp phát...";
                        if (name === "get_recent_defects") return done ? "Đã tra cứu phiếu báo hỏng" : "Đang tra cứu phiếu báo hỏng...";
                        return done ? `Đã hoàn thành ${name}` : `Đang thực thi ${name}...`;
                      };

                      return (
                        <div
                          key={idx}
                          className="my-1.5 flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-md px-2.5 py-1.5 border border-border/70 min-w-0"
                        >
                          {!isComplete ? (
                            <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                          ) : (
                            <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0" />
                          )}
                          <span className="font-medium truncate">
                            {getToolLabel(toolName, isComplete)}
                          </span>
                        </div>
                      );
                    })}

                    {m.content ? (
                      <AIMarkdown content={m.content} />
                    ) : (
                      !isLoading && (
                        <div className="text-xs text-muted-foreground italic py-1">
                          Đã hoàn thành tra cứu dữ liệu.
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="w-full space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground px-0.5">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/20">
                  <Bot className="size-3.5" />
                </div>
                <span>AI Copilot</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground py-2.5 px-3 bg-muted/50 rounded-2xl rounded-tl-xs border border-border/70">
                <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                <span className="truncate">AI Copilot đang xử lý và tổng hợp dữ liệu...</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => stop()}
                  className="h-6 text-[11px] px-2 ml-auto text-destructive hover:bg-destructive/10 shrink-0"
                >
                  Dừng lại
                </Button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Form nhập liệu */}
        <div className="border-t p-3 bg-background shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input || ""}
              onChange={handleInputChange}
              placeholder="Hỏi về vật tư, xăng dầu, quy trình... (Ctrl+J)"
              className="text-sm h-10 bg-muted/20 flex-1 min-w-0"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input || !input.trim()}
              className="size-10 shrink-0 shadow-xs"
              aria-label="Gửi tin nhắn"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
          <div className="flex items-center justify-between px-1 mt-1.5 text-[10px] text-muted-foreground">
            <span>MTP AI Engine • Omniroute Local</span>
            <span className="hidden sm:inline">Bấm <kbd className="rounded border bg-muted px-1">Ctrl</kbd> + <kbd className="rounded border bg-muted px-1">J</kbd> để mở nhanh</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
