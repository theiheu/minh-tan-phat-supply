"use client";

import * as React from "react";
import {
  Bot,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  RefreshCw,
  Sliders,
  MessageSquare,
  BookOpen,
  Cpu,
  Layers,
  Save,
  Fuel,
  PackageSearch,
  AlertTriangle,
  Wrench,
  Shield,
  Tag,
  ChevronRight,
  User,
  UploadCloud,
  FileText,
  FileUp,
  FileCode,
  Eye,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  toggleAiSystem,
  updateAiModelSettings,
  upsertQuickPrompt,
  deleteQuickPrompt,
  deleteConversationAction,
  triggerSyncKnowledgeAction,
  type QuickPromptInput,
} from "../actions/ai-admin-actions";
import {
  uploadDocumentAction,
  createManualDocumentAction,
  deleteDocumentAction,
} from "../actions/knowledge-actions";
import { AIMarkdown } from "@/components/ai/ai-markdown";
import { roleLabel } from "@/lib/labels";
import type { Role } from "@/lib/types";

export interface ConversationSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_role: string;
  user_avatar?: string;
  message_count: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: unknown;
  tool_results?: unknown;
  created_at: string;
}

export interface QuickPromptItem {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface KnowledgeDocItem {
  id: string;
  source_key: string;
  title: string;
  category: string;
  content_hash: string;
  chunk_count: number;
  updated_at: string;
}

export interface KnowledgeChunkItem {
  id: string;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown>;
}

interface AICopilotManagerProps {
  initialSettings: {
    ai_enabled: boolean;
    ai_model: string;
    ai_max_tokens: number;
  };
  initialQuickPrompts: QuickPromptItem[];
  initialConversations: ConversationSession[];
  initialKnowledgeDocs: KnowledgeDocItem[];
}

const AVAILABLE_ICONS = [
  { name: "PackageSearch", label: "Kho & Vật tư", icon: PackageSearch },
  { name: "AlertTriangle", label: "Cảnh báo cạn kho", icon: AlertTriangle },
  { name: "Fuel", label: "Nhiên liệu xăng dầu", icon: Fuel },
  { name: "BookOpen", label: "Quy trình SOP", icon: BookOpen },
  { name: "Wrench", label: "Sửa chữa & Dụng cụ", icon: Wrench },
  { name: "Shield", label: "Bảo mật & Quản trị", icon: Shield },
  { name: "Tag", label: "Danh mục", icon: Tag },
  { name: "Sparkles", label: "AI Mặc định", icon: Sparkles },
];

function getIconComponent(iconName: string) {
  const found = AVAILABLE_ICONS.find((i) => i.name === iconName);
  return found ? found.icon : Sparkles;
}

export function AICopilotManager({
  initialSettings,
  initialQuickPrompts,
  initialConversations,
  initialKnowledgeDocs,
}: AICopilotManagerProps) {
  const [activeTab, setActiveTab] = React.useState<"sessions" | "prompts" | "settings" | "knowledge">("sessions");

  // State Cấu hình
  const [aiEnabled, setAiEnabled] = React.useState(initialSettings.ai_enabled);
  const [aiModel, setAiModel] = React.useState(initialSettings.ai_model);
  const [maxTokens, setMaxTokens] = React.useState(initialSettings.ai_max_tokens);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);

  // State Gợi ý nhanh
  const [quickPrompts, setQuickPrompts] = React.useState(initialQuickPrompts);
  const [promptDialogOpen, setPromptDialogOpen] = React.useState(false);
  const [editingPrompt, setEditingPrompt] = React.useState<QuickPromptInput | null>(null);

  // State Lịch sử đàm thoại
  const [conversations, setConversations] = React.useState(initialConversations);
  const [sessionSearch, setSessionSearch] = React.useState("");
  const [selectedConversation, setSelectedConversation] = React.useState<ConversationSession | null>(null);
  const [messagesModalOpen, setMessagesModalOpen] = React.useState(false);
  const [activeMessages, setActiveMessages] = React.useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  // State Knowledge Base
  const [knowledgeDocs, setKnowledgeDocs] = React.useState(initialKnowledgeDocs);
  const [isSyncingKnowledge, setIsSyncingKnowledge] = React.useState(false);
  const [docUploadModalOpen, setDocUploadModalOpen] = React.useState(false);
  const [docUploadTab, setDocUploadTab] = React.useState<"file" | "manual">("file");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [docTitle, setDocTitle] = React.useState("");
  const [docCategory, setDocCategory] = React.useState("sop");
  const [docManualContent, setDocManualContent] = React.useState("");
  const [isSubmittingDoc, setIsSubmittingDoc] = React.useState(false);

  // State Chunks Inspector
  const [selectedDocForChunks, setSelectedDocForChunks] = React.useState<KnowledgeDocItem | null>(null);
  const [docChunks, setDocChunks] = React.useState<KnowledgeChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = React.useState(false);
  const [chunksModalOpen, setChunksModalOpen] = React.useState(false);

  // 1. Toggle AI System Master Switch
  const handleToggleAi = async (checked: boolean) => {
    setAiEnabled(checked);
    const res = await toggleAiSystem(checked);
    if (res.success) {
      toast.success(checked ? "Đã BẬT hệ thống AI Copilot." : "Đã TẮT hệ thống AI Copilot.");
    } else {
      toast.error(res.error || "Không thể cập nhật trạng thái.");
      setAiEnabled(!checked);
    }
  };

  // 2. Lưu cấu hình Model
  const handleSaveModelSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await updateAiModelSettings(aiModel, maxTokens);
      if (res.success) {
        toast.success("Đã cập nhật cấu hình Model & Giới hạn Token thành công.");
      } else {
        toast.error("Không thể lưu cấu hình.");
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 3. Mở Dialog Thêm/Sửa Quick Prompt
  const handleOpenPromptDialog = (prompt?: QuickPromptItem) => {
    if (prompt) {
      setEditingPrompt({
        id: prompt.id,
        label: prompt.label,
        prompt: prompt.prompt,
        icon: prompt.icon,
        display_order: prompt.display_order,
        is_active: prompt.is_active,
      });
    } else {
      setEditingPrompt({
        label: "",
        prompt: "",
        icon: "PackageSearch",
        display_order: quickPrompts.length + 1,
        is_active: true,
      });
    }
    setPromptDialogOpen(true);
  };

  // 4. Lưu Quick Prompt
  const handleSavePrompt = async () => {
    if (!editingPrompt || !editingPrompt.label.trim() || !editingPrompt.prompt.trim()) {
      toast.error("Vui lòng nhập đầy đủ tiêu đề và nội dung câu hỏi mẫu.");
      return;
    }

    const res = await upsertQuickPrompt(editingPrompt);
    if (res.success) {
      toast.success("Đã lưu gợi ý tra cứu nhanh.");
      setPromptDialogOpen(false);
      if (editingPrompt.id) {
        setQuickPrompts((prev) =>
          prev.map((p) => (p.id === editingPrompt.id ? { ...p, ...editingPrompt } as QuickPromptItem : p))
        );
      } else {
        setQuickPrompts((prev) => [
          ...prev,
          {
            ...editingPrompt,
            id: String(Date.now()),
            created_at: new Date().toISOString(),
          } as QuickPromptItem,
        ]);
      }
    } else {
      toast.error(res.error || "Không thể lưu gợi ý.");
    }
  };

  // 5. Xóa Quick Prompt
  const handleDeletePrompt = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa gợi ý tra cứu này?")) return;
    const res = await deleteQuickPrompt(id);
    if (res.success) {
      toast.success("Đã xóa câu hỏi gợi ý.");
      setQuickPrompts((prev) => prev.filter((p) => p.id !== id));
    } else {
      toast.error(res.error || "Không thể xóa câu hỏi gợi ý.");
    }
  };

  // 6. Xem chi tiết hội thoại
  const handleViewMessages = async (session: ConversationSession) => {
    setSelectedConversation(session);
    setMessagesModalOpen(true);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/ai/admin/conversations/${session.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setActiveMessages(data.messages || []);
      } else {
        toast.error("Không thể tải tin nhắn của phiên này.");
      }
    } catch {
      toast.error("Lỗi kết nối tải tin nhắn.");
    } finally {
      setLoadingMessages(false);
    }
  };

  // 7. Xóa phiên đàm thoại
  const handleDeleteConversation = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa vĩnh viễn phiên đàm thoại này?")) return;
    const res = await deleteConversationAction(id);
    if (res.success) {
      toast.success("Đã xóa phiên đàm thoại.");
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedConversation?.id === id) {
        setMessagesModalOpen(false);
      }
    } else {
      toast.error(res.error || "Không thể xóa phiên đàm thoại.");
    }
  };

  // 8. Đồng bộ lại tri thức SOP
  const handleSyncKnowledge = async () => {
    setIsSyncingKnowledge(true);
    try {
      const res = await triggerSyncKnowledgeAction();
      if (res.success) {
        toast.success(res.message || "Đã đồng bộ cơ sở tri thức SOP.");
      } else {
        toast.error(res.error || "Lỗi đồng bộ tri thức.");
      }
    } finally {
      setIsSyncingKnowledge(false);
    }
  };

  // 9. Nạp tài liệu mới (File hoặc Thủ công)
  const handleOpenDocModal = () => {
    setUploadFile(null);
    setDocTitle("");
    setDocCategory("sop");
    setDocManualContent("");
    setDocUploadTab("file");
    setDocUploadModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setUploadFile(f);
      if (!docTitle) {
        // Tự động điền tên tài liệu từ tên file
        const cleanName = f.name.replace(/.[^/.]+$/, "").replace(/[-_]/g, " ");
        setDocTitle(cleanName);
      }
    }
  };

  const handleSubmitNewDocument = async () => {
    if (!docTitle.trim()) {
      toast.error("Vui lòng nhập tên tài liệu.");
      return;
    }

    setIsSubmittingDoc(true);
    try {
      if (docUploadTab === "file") {
        if (!uploadFile) {
          toast.error("Vui lòng chọn file tài liệu (.pdf, .docx, .txt, .md).");
          return;
        }

        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("title", docTitle.trim());
        formData.append("category", docCategory);

        const res = await uploadDocumentAction(formData);
        if (res.success) {
          toast.success(res.message || "Đã nạp tài liệu thành công!");
          setDocUploadModalOpen(false);
          // Reload page data
          window.location.reload();
        } else {
          toast.error(res.error || "Không thể nạp file tài liệu.");
        }
      } else {
        if (!docManualContent.trim() || docManualContent.trim().length < 30) {
          toast.error("Nội dung văn bản tối thiểu phải từ 30 ký tự.");
          return;
        }

        const res = await createManualDocumentAction({
          title: docTitle.trim(),
          category: docCategory,
          content: docManualContent.trim(),
        });

        if (res.success) {
          toast.success(res.message || "Đã tạo tài liệu thành công!");
          setDocUploadModalOpen(false);
          window.location.reload();
        } else {
          toast.error(res.error || "Không thể lưu tài liệu.");
        }
      }
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  // 10. Xóa tài liệu khỏi Knowledge Base
  const handleDeleteDoc = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tài liệu "${title}" và tất cả phân đoạn tri thức liên quan?`)) return;
    const res = await deleteDocumentAction(id);
    if (res.success) {
      toast.success("Đã xóa tài liệu khỏi cơ sở tri thức.");
      setKnowledgeDocs((prev) => prev.filter((d) => d.id !== id));
    } else {
      toast.error(res.error || "Không thể xóa tài liệu.");
    }
  };

  // 11. Xem Chunks của tài liệu
  const handleViewChunks = async (doc: KnowledgeDocItem) => {
    setSelectedDocForChunks(doc);
    setChunksModalOpen(true);
    setLoadingChunks(true);
    try {
      const res = await fetch(`/api/ai/admin/documents/${doc.id}/chunks`);
      if (res.ok) {
        const data = await res.json();
        setDocChunks(data.chunks || []);
      } else {
        toast.error("Không thể tải các phân đoạn của tài liệu này.");
      }
    } catch {
      toast.error("Lỗi kết nối tải phân đoạn.");
    } finally {
      setLoadingChunks(false);
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(
    (c) =>
      c.user_name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Quick Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2.5">
            <Bot className="size-6 text-primary" />
            Trung tâm Quản trị AI Copilot
            <Badge
              variant={aiEnabled ? "default" : "destructive"}
              className="ml-2 font-medium text-xs px-2 py-0.5"
            >
              {aiEnabled ? "Đang Bật" : "Đang Tạm Tắt"}
            </Badge>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Kiểm soát phiên đàm thoại của người dùng, nạp tài liệu SOP trực tiếp và cấu hình mô hình AI Omniroute.
          </p>
        </div>

        {/* Master Switch on Top Right */}
        <div className="flex items-center gap-3 bg-card border px-3.5 py-2 rounded-xl shadow-2xs shrink-0">
          <div className="text-xs font-medium">
            <span className="block text-foreground font-semibold">Trạng thái AI</span>
            <span className="text-[11px] text-muted-foreground">
              {aiEnabled ? "Toàn trại truy cập được" : "Tạm khóa mọi người dùng"}
            </span>
          </div>
          <Switch checked={aiEnabled} onCheckedChange={handleToggleAi} />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto">
        <Button
          variant={activeTab === "sessions" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("sessions")}
          className="gap-2 text-xs sm:text-sm"
        >
          <MessageSquare className="size-4" />
          <span>Lịch sử đàm thoại ({conversations.length})</span>
        </Button>
        <Button
          variant={activeTab === "prompts" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("prompts")}
          className="gap-2 text-xs sm:text-sm"
        >
          <Sparkles className="size-4" />
          <span>Gợi ý tra cứu nhanh ({quickPrompts.length})</span>
        </Button>
        <Button
          variant={activeTab === "knowledge" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("knowledge")}
          className="gap-2 text-xs sm:text-sm"
        >
          <BookOpen className="size-4" />
          <span>Cơ sở tri thức SOP ({knowledgeDocs.length})</span>
        </Button>
        <Button
          variant={activeTab === "settings" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("settings")}
          className="gap-2 text-xs sm:text-sm"
        >
          <Sliders className="size-4" />
          <span>Cấu hình & Model</span>
        </Button>
      </div>

      {/* TAB 1: LỊCH SỬ ĐÀM THOẠI (SESSIONS) */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Tìm theo tên nhân viên, chủ đề..."
                className="pl-9 text-xs sm:text-sm h-9"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Hiển thị {filteredConversations.length} phiên trò chuyện
            </div>
          </div>

          {filteredConversations.length === 0 ? (
            <Card className="py-12 text-center text-muted-foreground">
              <MessageSquare className="size-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">Chưa có phiên trò chuyện nào được ghi nhận.</p>
              <p className="text-xs">Khi nhân viên nhắn tin với AI Copilot, các cuộc đàm thoại sẽ xuất hiện tại đây.</p>
            </Card>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b">
                    <tr>
                      <th className="px-4 py-3">Người dùng</th>
                      <th className="px-4 py-3">Vai trò</th>
                      <th className="px-4 py-3">Chủ đề cuộc trò chuyện</th>
                      <th className="px-4 py-3 text-center">Số tin nhắn</th>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredConversations.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {c.user_name ? c.user_name.charAt(0).toUpperCase() : <User className="size-3.5" />}
                            </div>
                            <span className="font-semibold text-foreground">{c.user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {roleLabel(c.user_role as Role)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate font-medium text-foreground">
                          {c.title}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center size-5 rounded-full bg-muted font-bold text-[11px]">
                            {c.message_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(c.updated_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewMessages(c)}
                            className="h-7 text-xs px-2.5 text-primary hover:bg-primary/10 font-medium"
                          >
                            Xem chi tiết
                            <ChevronRight className="size-3.5 ml-1" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteConversation(c.id)}
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1"
                            title="Xóa phiên"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GỢI Ý TRA CỨU NHANH (QUICK PROMPTS) */}
      {activeTab === "prompts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Danh sách các câu hỏi gợi ý nhanh</h3>
              <p className="text-xs text-muted-foreground">
                Các câu hỏi này sẽ xuất hiện trên màn hình khi người dùng mở AI Copilot lần đầu.
              </p>
            </div>
            <Button size="sm" onClick={() => handleOpenPromptDialog()} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              <span>Thêm câu hỏi mới</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickPrompts.map((p) => {
              const IconComp = getIconComponent(p.icon);
              return (
                <Card key={p.id} className="p-3.5 relative flex flex-col justify-between shadow-2xs hover:border-primary/40 transition">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <IconComp className="size-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-xs text-foreground">{p.label}</h4>
                          <span className="text-[10px] text-muted-foreground">Thứ tự: {p.display_order}</span>
                        </div>
                      </div>
                      <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {p.is_active ? "Đang bật" : "Đã ẩn"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 bg-muted/40 p-2 rounded-md">
                      {p.prompt}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenPromptDialog(p)}
                      className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3" />
                      <span>Sửa</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePrompt(p.id)}
                      className="h-7 text-xs px-2 gap-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                      <span>Xóa</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CƠ SỞ TRI THỨC SOP & NẠP TÀI LIỆU TRỰC TIẾP */}
      {activeTab === "knowledge" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                Cơ sở tri thức SOP & Hướng dẫn (RAG Documents)
              </h3>
              <p className="text-xs text-muted-foreground">
                Tài liệu được băm SHA-256 và cắt thành các đoạn văn ngắn giúp AI trả lời chính xác quy trình vận hành.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleOpenDocModal}
                className="gap-1.5 text-xs bg-linear-to-r from-primary to-amber-500 hover:opacity-95 shadow-xs"
              >
                <UploadCloud className="size-3.5" />
                <span>Nạp tài liệu mới (PDF / Word / Text)</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncKnowledge}
                disabled={isSyncingKnowledge}
                className="gap-1.5 text-xs"
                title="Quét lại các file trong thư mục docs/user-guide"
              >
                <RefreshCw className={"size-3.5 " + (isSyncingKnowledge ? "animate-spin" : "")} />
                <span className="hidden sm:inline">Đồng bộ từ docs</span>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b">
                  <tr>
                    <th className="px-4 py-3">Tên tài liệu SOP / Quy trình</th>
                    <th className="px-4 py-3">Phân loại</th>
                    <th className="px-4 py-3 text-center">Số Chunks</th>
                    <th className="px-4 py-3">Mã Hash</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {knowledgeDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground max-w-xs truncate">
                        {doc.title}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {doc.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px]">
                          {doc.chunk_count} đoạn
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {doc.content_hash.slice(0, 10)}...
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                          <CheckCircle2 className="size-3.5" />
                          Đã index
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewChunks(doc)}
                          className="h-7 text-xs px-2 text-primary hover:bg-primary/10 font-medium gap-1"
                        >
                          <Eye className="size-3" />
                          <span>Xem phân đoạn</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDoc(doc.id, doc.title)}
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1"
                          title="Xóa tài liệu"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CẤU HÌNH & MODEL SETTINGS */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 space-y-4 p-5">
            <CardHeader className="p-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="size-5 text-primary" />
                Cấu hình Mô hình & Giới hạn
              </CardTitle>
              <CardDescription className="text-xs">
                Thiết lập định tuyến model AI trên Omniroute và lượng Token tối đa.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Model AI mặc định (Omniroute Model Route)</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue placeholder="Chọn model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto/fast">⚡ auto/fast (Phản hồi siêu tốc, tiết kiệm tài nguyên)</SelectItem>
                    <SelectItem value="auto/chat">🚀 auto/chat (Đàm thoại mượt mà, giải thích SOP)</SelectItem>
                    <SelectItem value="auto/smart">🧠 auto/smart (Suy luận thông minh & phân tích sâu)</SelectItem>
                    <SelectItem value="antigravity/gemini-3.7-flash-high">✨ antigravity/gemini-3.7-flash-high</SelectItem>
                    <SelectItem value="auto/coding">💻 auto/coding (Logic dữ liệu chặt chẽ)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Hệ thống kết nối trực tiếp với Omniroute Local server tại <code>http://127.0.0.1:20128/v1</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Giới hạn Max Tokens (Độ dài câu trả lời)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={300}
                    max={4000}
                    step={100}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-36 text-xs sm:text-sm"
                  />
                  <span className="text-xs text-muted-foreground">tokens (Khuyến nghị: 1000 - 2000)</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSaveModelSettings}
                  disabled={isSavingSettings}
                  className="gap-2 text-xs sm:text-sm"
                >
                  <Save className="size-4" />
                  <span>{isSavingSettings ? "Đang lưu..." : "Lưu thay đổi"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Metric Overview */}
          <div className="space-y-4">
            <Card className="p-4 bg-linear-to-br from-primary/5 to-muted border-primary/20">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Tổng phiên trò chuyện</span>
                <MessageSquare className="size-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{conversations.length}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Được ghi nhận trên cơ sở dữ liệu</p>
            </Card>

            <Card className="p-4 bg-linear-to-br from-amber-500/5 to-muted border-amber-500/20">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Tài liệu SOP đã Index</span>
                <Layers className="size-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{knowledgeDocs.length}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Đã phân đoạn Vector & FTS</p>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL NẠP TÀI LIỆU TRỰC TIẾP (UPLOAD FILE / NHẬP THỦ CÔNG) */}
      <Dialog open={docUploadModalOpen} onOpenChange={setDocUploadModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UploadCloud className="size-5 text-primary" />
              <span>Nạp tài liệu mới vào Cơ sở tri thức AI</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Hỗ trợ tải lên file Word (.docx), PDF, Text, Markdown hoặc nhập trực tiếp văn bản quy trình.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Tab selector */}
            <div className="flex items-center gap-2 border-b pb-2">
              <Button
                variant={docUploadTab === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocUploadTab("file")}
                className="gap-1.5 text-xs h-8 flex-1"
              >
                <FileUp className="size-3.5" />
                <span>Tải lên File (.pdf, .docx, .txt, .md)</span>
              </Button>
              <Button
                variant={docUploadTab === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocUploadTab("manual")}
                className="gap-1.5 text-xs h-8 flex-1"
              >
                <FileCode className="size-3.5" />
                <span>Nhập văn bản trực tiếp</span>
              </Button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên tài liệu / Tiêu đề quy trình</Label>
                <Input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Ví dụ: Quy trình nhập kho cám thức ăn 2026"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phân loại tài liệu</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Chọn phân loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sop">Quy trình vận hành chuẩn (SOP)</SelectItem>
                    <SelectItem value="user_guide">Hướng dẫn sử dụng phần mềm</SelectItem>
                    <SelectItem value="policy">Chính sách & Quy định trang trại</SelectItem>
                    <SelectItem value="catalog">Thông số kỹ thuật & Danh mục</SelectItem>
                    <SelectItem value="general">Tài liệu chung</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {docUploadTab === "file" ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Chọn file tài liệu</Label>
                  <label className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-muted/20 hover:bg-muted/40 cursor-pointer transition">
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.md,.markdown"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <FileText className="size-8 text-primary/70" />
                    {uploadFile ? (
                      <div className="text-center">
                        <div className="font-semibold text-xs text-foreground">{uploadFile.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {(uploadFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-xs font-medium text-foreground">Click để chọn file hoặc kéo thả vào đây</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Hỗ trợ: PDF (.pdf), Word (.docx), Văn bản (.txt, .md)
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nội dung tài liệu (Hỗ trợ Markdown)</Label>
                  <textarea
                    value={docManualContent}
                    onChange={(e) => setDocManualContent(e.target.value)}
                    placeholder="# TIÊU ĐỀ QUY TRÌNH

Bước 1: ...
Bước 2: ...

> Lưu ý: ..."
                    className="w-full h-44 rounded-md border border-input bg-transparent p-3 text-xs font-mono shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Hệ thống sẽ tự động băm SHA-256 và cắt thành các đoạn tri thức chuẩn cho AI.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-3 border-t bg-background shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDocUploadModalOpen(false)}>
              Hủy
            </Button>
            <Button size="sm" onClick={handleSubmitNewDocument} disabled={isSubmittingDoc} className="gap-2">
              {isSubmittingDoc ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
              <span>{isSubmittingDoc ? "Đang xử lý & phân đoạn..." : "Nạp vào Knowledge Base"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL XEM PHÂN ĐOẠN (CHUNKS INSPECTOR) */}
      <Dialog open={chunksModalOpen} onOpenChange={setChunksModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <span>Các phân đoạn tri thức (Chunks) của: {selectedDocForChunks?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tổng cộng {docChunks.length} phân đoạn tri thức được AI lập chỉ mục Full-Text & Vector.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
            {loadingChunks ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
                <RefreshCw className="size-4 animate-spin text-primary" />
                <span>Đang tải các phân đoạn...</span>
              </div>
            ) : docChunks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                Chưa có phân đoạn nào trong tài liệu này.
              </div>
            ) : (
              docChunks.map((chunk, idx) => (
                <div key={chunk.id || idx} className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs border-b pb-1.5">
                    <span className="font-semibold text-primary">Phân đoạn #{chunk.chunk_index + 1}</span>
                    <span className="text-[10px] text-muted-foreground">{chunk.content.length} ký tự</span>
                  </div>
                  <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed bg-muted/40 p-2.5 rounded-md font-mono text-[11px]">
                    {chunk.content}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="p-3 border-t bg-background shrink-0">
            <Button variant="outline" size="sm" onClick={() => setChunksModalOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL THÊM / SỬA QUICK PROMPT */}
      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingPrompt?.id ? "Chỉnh sửa câu hỏi gợi ý" : "Thêm câu hỏi gợi ý mới"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Câu hỏi này sẽ xuất hiện trên thanh gợi ý nhanh của AI Copilot.
            </DialogDescription>
          </DialogHeader>

          {editingPrompt && (
            <div className="space-y-3.5 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tiêu đề gợi ý (Ngắn gọn)</Label>
                <Input
                  value={editingPrompt.label}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, label: e.target.value })}
                  placeholder="Ví dụ: Tồn kho van bi"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nội dung câu lệnh gửi AI (Prompt)</Label>
                <textarea
                  value={editingPrompt.prompt}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt: e.target.value })}
                  placeholder="Ví dụ: Tra cứu tồn kho thực tế của van bi tại các kho hiện tại."
                  className="w-full h-20 rounded-md border border-input bg-transparent px-3 py-2 text-xs sm:text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Biểu tượng (Icon)</Label>
                  <Select
                    value={editingPrompt.icon}
                    onValueChange={(val) => setEditingPrompt({ ...editingPrompt, icon: val })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Chọn icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ICONS.map((i) => {
                        const Icon = i.icon;
                        return (
                          <SelectItem key={i.name} value={i.name} className="text-xs">
                            <div className="flex items-center gap-2">
                              <Icon className="size-3.5" />
                              <span>{i.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Thứ tự hiển thị</Label>
                  <Input
                    type="number"
                    value={editingPrompt.display_order ?? 1}
                    onChange={(e) =>
                      setEditingPrompt({ ...editingPrompt, display_order: Number(e.target.value) })
                    }
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs font-semibold">Bật hiển thị</Label>
                <Switch
                  checked={editingPrompt.is_active}
                  onCheckedChange={(checked) =>
                    setEditingPrompt({ ...editingPrompt, is_active: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setPromptDialogOpen(false)}>
              Hủy
            </Button>
            <Button size="sm" onClick={handleSavePrompt}>
              Lưu gợi ý
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CHI TIẾT ĐÀM THOẠI (SESSION MESSAGES) */}
      <Dialog open={messagesModalOpen} onOpenChange={setMessagesModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Bot className="size-5 text-primary" />
                  <span>Chi tiết đàm thoại: {selectedConversation?.title}</span>
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Người dùng: <strong className="text-foreground">{selectedConversation?.user_name}</strong> (
                  {roleLabel(selectedConversation?.user_role as Role)}) •{" "}
                  {selectedConversation?.updated_at &&
                    new Date(selectedConversation.updated_at).toLocaleString("vi-VN")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
                <RefreshCw className="size-4 animate-spin text-primary" />
                <span>Đang tải nội dung tin nhắn...</span>
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                Chưa có tin nhắn nào trong phiên này.
              </div>
            ) : (
              activeMessages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={"flex gap-3 " + (isUser ? "justify-end" : "justify-start")}
                  >
                    {!isUser && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5 border border-primary/20">
                        <Bot className="size-4" />
                      </div>
                    )}

                    <div
                      className={
                        "rounded-2xl px-4 py-3 max-w-[85%] leading-relaxed text-xs sm:text-sm " +
                        (isUser
                          ? "bg-primary text-primary-foreground font-medium shadow-xs"
                          : "bg-card border border-border text-foreground shadow-xs")
                      }
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      ) : (
                        <AIMarkdown content={m.content} />
                      )}
                    </div>

                    {isUser && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5 border">
                        <User className="size-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="p-3 border-t bg-background shrink-0">
            <Button variant="outline" size="sm" onClick={() => setMessagesModalOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
