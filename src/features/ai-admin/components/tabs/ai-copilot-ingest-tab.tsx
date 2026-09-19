"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import {
  Sparkles,
  Bot,
  Send,
  Loader2,
  RefreshCw,
  FileUp,
  FileText,
  CheckCircle2,
  Edit3,
  Copy,
  BookOpen,
  Shield,
  Wrench,
  Package,
  Layers,
  Check,
  X,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AIMarkdown } from "@/components/ai/ai-markdown";
import { extractStandardizedDraft } from "@/lib/ai/knowledge/standardizer";
import {
  extractTextFromUploadAction,
  ingestStandardizedDocAction,
} from "../../actions/knowledge-actions";
import { StandardizedKnowledgeDraft, KnowledgeDocItem } from "../../types";

interface AICopilotIngestTabProps {
  onDocIngested?: (newDoc: KnowledgeDocItem) => void;
}

interface AttachedFileState {
  name: string;
  size: number;
  content: string;
}

const TEMPLATE_PROMPTS = [
  {
    icon: BookOpen,
    label: "Quy trình SOP mới",
    prompt:
      "Hãy chuẩn hóa quy trình xuất kho vật tư đột xuất ngoài giờ hành chính tại trang trại (yêu cầu phê duyệt qua điện thoại của Quản lý trại, lập phiếu bổ sung trong 24h).",
  },
  {
    icon: Shield,
    label: "Quy chế & An toàn",
    prompt:
      "Soạn thảo quy chế an toàn lao động khi vào khu chuồng nuôi cách ly: Trang phục bảo hộ, sát trùng ủng/xe, không mang thiết bị lạ, chế tài xử lý nếu vi phạm.",
  },
  {
    icon: Wrench,
    label: "Khắc phục sự cố",
    prompt:
      "Viết hướng dẫn các bước xử lý khẩn cấp khi hệ thống quạt thông gió chuồng bị ngắt điện: Chuyển máy phát dự phòng, mở cửa gió khẩn cấp, báo đội cơ điện.",
  },
  {
    icon: Package,
    label: "Tiêu chuẩn vật tư",
    prompt:
      "Soạn tài liệu tiêu chuẩn quy cách và bảo quản thuốc sát trùng chuồng trại: Đơn vị tính (Can 5L, Thùng 4 can), nhiệt độ bảo quản 20-25 độ C, hạn sử dụng sau khi mở nắp.",
  },
];

export function AICopilotIngestTab({ onDocIngested }: AICopilotIngestTabProps) {
  const [attachedFile, setAttachedFile] = React.useState<AttachedFileState | null>(null);
  const [isExtractingFile, setIsExtractingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const chatBottomRef = React.useRef<HTMLDivElement>(null);

  // Lưu trạng thái tài liệu đã được nạp thành công trong phiên (theo index của message)
  const [ingestedDrafts, setIngestedDrafts] = React.useState<Record<string, { docId: string; chunkCount: number }>>({});
  const [ingestingDraftId, setIngestingDraftId] = React.useState<string | null>(null);

  // Trạng thái chỉnh sửa trực tiếp bản thảo (theo messageId)
  const [editingDrafts, setEditingDrafts] = React.useState<Record<string, StandardizedKnowledgeDraft>>({});
  const [editingModeMap, setEditingModeMap] = React.useState<Record<string, boolean>>({});
  const [copiedDraftId, setCopiedDraftId] = React.useState<string | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: _originalHandleSubmit,
    isLoading,
    setMessages,
    setInput,
    append,
  } = useChat({
    api: "/api/ai/ingest-chat",
    onError: (err) => {
      toast.error(err.message || "Lỗi giao tiếp với AI Chuẩn hóa Tri thức.");
    },
  });

  // Tự động cuộn xuống khi có tin nhắn mới
  React.useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Xử lý upload file và trích xuất text
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingFile(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await extractTextFromUploadAction(formData);
      if (res.success && res.text) {
        setAttachedFile({
          name: res.fileName || file.name,
          size: res.fileSize || file.size,
          content: res.text,
        });
        toast.success(`Đã trích xuất nội dung từ file "${file.name}" (${res.text.length} ký tự).`);
      } else {
        toast.error(res.error || "Không thể đọc nội dung file.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi đọc file.");
    } finally {
      setIsExtractingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Submit chat kèm nội dung file đính kèm nếu có
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((!input || !input.trim()) && !attachedFile) return;

    let fullPrompt = input.trim();
    if (attachedFile) {
      fullPrompt = `[TÀI LIỆU ĐÍNH KÈM: ${attachedFile.name}]
${attachedFile.content}

[YÊU CẦU CỦA ADMIN]: ${fullPrompt || "Hãy phân tích và chuẩn hóa tài liệu đính kèm trên thành quy trình chuẩn SOP."}`;
      setAttachedFile(null);
    }

    append({
      role: "user",
      content: fullPrompt,
    });
    setInput("");
  };

  // Nạp bản thảo vào CSDL Tri thức AI
  const handleIngestDraft = async (messageId: string, fallbackDraft: StandardizedKnowledgeDraft) => {
    const currentDraft = editingDrafts[messageId] || fallbackDraft;
    setIngestingDraftId(messageId);

    try {
      const res = await ingestStandardizedDocAction({
        title: currentDraft.title,
        category: currentDraft.category,
        content: currentDraft.content,
        summary: currentDraft.summary,
        keywords: currentDraft.keywords,
      });

      if (res.success && res.docId) {
        setIngestedDrafts((prev) => ({
          ...prev,
          [messageId]: { docId: res.docId!, chunkCount: res.chunkCount || 0 },
        }));
        toast.success(res.message || "Đã nạp thành công vào CSDL Tri thức AI!");

        if (onDocIngested) {
          onDocIngested({
            id: res.docId,
            source_key: `ai_standardized:${Date.now()}`,
            title: currentDraft.title,
            category: currentDraft.category,
            content_hash: "",
            chunk_count: res.chunkCount || 0,
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        toast.error(res.error || "Không thể nạp tài liệu vào CSDL.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi nạp tài liệu.");
    } finally {
      setIngestingDraftId(null);
    }
  };

  // Sao chép nội dung Markdown
  const handleCopyMarkdown = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedDraftId(messageId);
    toast.success("Đã sao chép nội dung Markdown vào clipboard.");
    setTimeout(() => setCopiedDraftId(null), 2000);
  };

  // Cập nhật trường trong bản thảo đang chỉnh sửa
  const handleUpdateDraftField = (messageId: string, baseDraft: StandardizedKnowledgeDraft, field: keyof StandardizedKnowledgeDraft, val: unknown) => {
    const current = editingDrafts[messageId] || baseDraft;
    setEditingDrafts((prev) => ({
      ...prev,
      [messageId]: {
        ...current,
        [field]: val,
      },
    }));
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "sop":
        return { label: "Quy trình SOP", variant: "default" as const, icon: BookOpen };
      case "user_guide":
        return { label: "Hướng dẫn sử dụng", variant: "secondary" as const, icon: Layers };
      case "catalog":
        return { label: "Danh mục & Vật tư", variant: "outline" as const, icon: Package };
      case "policy":
        return { label: "Quy chế & An toàn", variant: "destructive" as const, icon: Shield };
      default:
        return { label: "Tài liệu chung", variant: "outline" as const, icon: FileText };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Giới thiệu tính năng */}
      <div className="bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs">
                <Sparkles className="size-4.5" />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-foreground">
                Trò chuyện & Chuẩn hóa Tri thức AI
              </h3>
              <Badge variant="outline" className="bg-background/80 text-primary border-primary/30 font-semibold text-[11px]">
                AI Knowledge Ingestion Studio
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl">
              Đưa thông tin thô, ghi chú cuộc họp, chính sách hoặc tải file (.pdf, .docx, .txt, .md) ➔ AI sẽ 
              <strong> cấu trúc hóa, chuẩn hóa thành văn bản SOP tiêu chuẩn</strong> ➔ Bạn xem trước, điều chỉnh và bấm 
              <strong> Nạp trực tiếp vào CSDL Tri thức AI</strong> chỉ với 1 cú nhấp.
            </p>
          </div>

          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMessages([]);
                setEditingDrafts({});
                setEditingModeMap({});
                setIngestedDrafts({});
                toast.info("Đã làm mới phiên trò chuyện chuẩn hóa.");
              }}
              className="gap-1.5 text-xs self-start sm:self-auto shrink-0"
            >
              <RefreshCw className="size-3.5" />
              Tạo phiên mới
            </Button>
          )}
        </div>

        {/* Template Prompts (chỉ hiện khi chưa có tin nhắn) */}
        {messages.length === 0 && (
          <div className="mt-4 pt-3 border-t border-primary/10">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Gợi ý kịch bản chuẩn hóa nhanh:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {TEMPLATE_PROMPTS.map((tpl, i) => {
                const IconComponent = tpl.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInput(tpl.prompt);
                    }}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border/70 bg-card hover:bg-accent/60 hover:border-primary/40 text-left transition-all group"
                  >
                    <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <IconComponent className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {tpl.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {tpl.prompt}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Conversation Stream */}
      <div className="bg-card border rounded-2xl p-4 min-h-[420px] max-h-[650px] overflow-y-auto space-y-5 shadow-2xs">
        {messages.length === 0 ? (
          <div className="h-[380px] flex flex-col items-center justify-center text-center p-6 space-y-3 text-muted-foreground">
            <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Bot className="size-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Sẵn sàng tiếp nhận thông tin để chuẩn hóa
              </h4>
              <p className="text-xs">
                Bạn có thể gõ yêu cầu vào khung chat bên dưới hoặc bấm nút <strong>&quot;Đính kèm file&quot;</strong> để AI đọc và chuyển đổi tài liệu thô thành SOP hoàn chỉnh.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === "user";
            const { cleanText, draft } = isUser ? { cleanText: m.content, draft: null } : extractStandardizedDraft(m.content);
            const currentDraft = draft ? (editingDrafts[m.id] || draft) : null;
            const isIngested = draft && ingestedDrafts[m.id];
            const isEditing = editingModeMap[m.id];

            return isUser ? (
              <div key={m.id || idx} className="flex flex-col items-end w-full space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium pr-1">
                  <span>Admin</span>
                  <User className="size-3 text-muted-foreground" />
                </div>
                <div className="rounded-2xl rounded-tr-xs px-4 py-2.5 max-w-[88%] sm:max-w-[80%] bg-primary text-primary-foreground text-xs sm:text-sm leading-relaxed shadow-2xs">
                  <div className="whitespace-pre-wrap">{cleanText}</div>
                </div>
              </div>
            ) : (
              <div key={m.id || idx} className="flex flex-col items-start w-full space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground px-0.5">
                  <div className="size-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                    <Bot className="size-3.5" />
                  </div>
                  <span>AI Chuẩn hóa Tri thức</span>
                  <span className="text-[10px] font-normal text-muted-foreground">• MTP SOP Engine</span>
                </div>

                {/* Bong bóng tin nhắn hội thoại */}
                {cleanText && (
                  <div className="w-full rounded-2xl rounded-tl-xs px-4 py-3 text-xs sm:text-sm leading-relaxed bg-muted/70 border text-foreground shadow-2xs">
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{cleanText}</div>
                      ) : (
                        <AIMarkdown content={cleanText} />
                      )}
                    </div>
                  )}

                  {/* KHỐI HIỂN THỊ BẢN THẢO TRI THỨC CHUẨN HÓA (Interactive Draft Card) */}
                  {currentDraft && (
                    <div className="w-full bg-card border-2 border-primary/30 rounded-2xl overflow-hidden shadow-md">
                      {/* Card Header */}
                      <div className="bg-primary/5 border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                            <FileText className="size-3.5" />
                          </div>
                          <span className="font-bold text-xs sm:text-sm text-foreground">
                            Bản thảo Tri thức Chuẩn hóa
                          </span>
                          {isIngested ? (
                            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 gap-1 text-[11px]">
                              <CheckCircle2 className="size-3" /> Đã nạp vào CSDL
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-[11px] text-primary bg-primary/10 border-primary/20">
                              <Sparkles className="size-3" /> Sẵn sàng nạp
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyMarkdown(m.id, currentDraft.content)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            {copiedDraftId === m.id ? (
                              <>
                                <Check className="size-3 text-emerald-600" />
                                <span className="text-emerald-600">Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Sao chép</span>
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant={isEditing ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setEditingModeMap((prev) => ({ ...prev, [m.id]: !isEditing }));
                              if (!editingDrafts[m.id]) {
                                setEditingDrafts((prev) => ({ ...prev, [m.id]: currentDraft }));
                              }
                            }}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Edit3 className="size-3" />
                            <span>{isEditing ? "Xong sửa" : "Sửa trực tiếp"}</span>
                          </Button>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-4">
                        {/* Title & Category Row */}
                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2 space-y-1">
                              <Label className="text-xs font-semibold">Tiêu đề tài liệu:</Label>
                              <Input
                                value={currentDraft.title}
                                onChange={(e) => handleUpdateDraftField(m.id, currentDraft, "title", e.target.value)}
                                className="h-8 text-xs font-medium"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Danh mục:</Label>
                              <Select
                                value={currentDraft.category}
                                onValueChange={(val) => handleUpdateDraftField(m.id, currentDraft, "category", val)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sop">Quy trình SOP</SelectItem>
                                  <SelectItem value="user_guide">Hướng dẫn sử dụng</SelectItem>
                                  <SelectItem value="catalog">Danh mục & Vật tư</SelectItem>
                                  <SelectItem value="policy">Quy chế & An toàn</SelectItem>
                                  <SelectItem value="general">Tài liệu chung</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                            <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                              {currentDraft.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {(() => {
                                const cat = getCategoryLabel(currentDraft.category);
                                const CatIcon = cat.icon;
                                return (
                                  <Badge variant={cat.variant} className="gap-1 text-xs">
                                    <CatIcon className="size-3" />
                                    {cat.label}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Summary */}
                        {currentDraft.summary && (
                          <div className="bg-muted/40 rounded-xl p-2.5 text-xs text-muted-foreground italic border">
                            <strong>Tóm tắt:</strong> {currentDraft.summary}
                          </div>
                        )}

                        {/* Content area: Editing vs Markdown Preview */}
                        {isEditing ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold">Nội dung văn bản Markdown:</Label>
                              <span className="text-[11px] text-muted-foreground">{currentDraft.content.length} ký tự</span>
                            </div>
                            <Textarea
                              value={currentDraft.content}
                              onChange={(e) => handleUpdateDraftField(m.id, currentDraft, "content", e.target.value)}
                              rows={12}
                              className="font-mono text-xs leading-relaxed"
                            />
                          </div>
                        ) : (
                          <div className="max-h-[350px] overflow-y-auto bg-muted/20 border rounded-xl p-3 text-xs sm:text-sm">
                            <AIMarkdown content={currentDraft.content} />
                          </div>
                        )}

                        {/* Keywords Pill List */}
                        {currentDraft.keywords && currentDraft.keywords.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-muted-foreground font-semibold">Từ khóa:</span>
                            {currentDraft.keywords.map((kw, kIdx) => (
                              <Badge key={kIdx} variant="outline" className="text-[10px] py-0 px-2 bg-background">
                                #{kw}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Card Footer Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t">
                          {isIngested ? (
                            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="size-4" />
                              <span>Đã lưu vào CSDL (ID: {ingestedDrafts[m.id].docId.slice(0, 8)}... - {ingestedDrafts[m.id].chunkCount} phân đoạn)</span>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Bản thảo đã được chuẩn hóa. Nhấn nút bên cạnh để nạp trực tiếp.
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="default"
                            disabled={Boolean(isIngested) || ingestingDraftId === m.id}
                            onClick={() => handleIngestDraft(m.id, currentDraft)}
                            className="gap-2 text-xs font-bold sm:self-end bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                          >
                            {ingestingDraftId === m.id ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                Đang nạp vào CSDL...
                              </>
                            ) : isIngested ? (
                              <>
                                <CheckCircle2 className="size-3.5" />
                                Đã nạp thành công
                              </>
                            ) : (
                              <>
                                <Sparkles className="size-3.5" />
                                🚀 Nạp vào CSDL Tri thức AI
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="w-full space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground px-0.5">
              <div className="size-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                <Bot className="size-3.5" />
              </div>
              <span>AI Chuẩn hóa Tri thức</span>
              <span className="text-[10px] font-normal text-muted-foreground">• MTP SOP Engine</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground py-2.5 px-3.5 bg-muted/50 rounded-2xl rounded-tl-xs border border-border/70">
              <Loader2 className="size-4 animate-spin text-primary shrink-0" />
              <span>AI đang phân tích và chuẩn hóa văn bản theo quy chuẩn Farm SOP...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Attached File Preview Pill */}
      {attachedFile && (
        <div className="flex items-center justify-between gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="size-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground truncate">{attachedFile.name}</span>
            <span className="text-muted-foreground text-[11px] shrink-0">({(attachedFile.size / 1024).toFixed(1)} KB - Đã đọc)</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAttachedFile(null)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Chat Input & File Attachment Toolbar */}
      <form onSubmit={handleFormSubmit} className="space-y-2">
        <div className="flex items-end gap-2 bg-card border rounded-2xl p-2 shadow-2xs focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          {/* File Upload Trigger */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.md,.markdown,.docx,.doc,.pdf"
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isExtractingFile || isLoading}
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm file tài liệu (.pdf, .docx, .txt, .md)"
            className="size-9 p-0 rounded-xl shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
          >
            {isExtractingFile ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <FileUp className="size-4.5" />
            )}
          </Button>

          {/* Prompt Textarea */}
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder={
              attachedFile
                ? "Nhập thêm yêu cầu chuẩn hóa cho file đính kèm (hoặc nhấn Gửi trực tiếp)..."
                : "Nhập thông tin quy trình, dán ghi chú thô, hoặc đính kèm file để AI chuẩn hóa..."
            }
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleFormSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
              }
            }}
            className="border-0 focus-visible:ring-0 shadow-none resize-none p-1.5 text-xs sm:text-sm bg-transparent min-h-[44px] max-h-[140px]"
          />

          {/* Send Button */}
          <Button
            type="submit"
            disabled={isLoading || ((!input || !input.trim()) && !attachedFile)}
            size="sm"
            className="size-9 p-0 rounded-xl shrink-0 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-40"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2">
          <span>Hỗ trợ đính kèm: PDF, Word (.docx), Markdown (.md), Text (.txt)</span>
          <span>Nhấn <strong>Enter</strong> để gửi, <strong>Shift+Enter</strong> để xuống dòng</span>
        </div>
      </form>
    </div>
  );
}
