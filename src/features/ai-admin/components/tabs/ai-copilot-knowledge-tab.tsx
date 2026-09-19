"use client";

import * as React from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  UploadCloud,
  FileText,
  FileUp,
  FileCode,
  Loader2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { triggerSyncKnowledgeAction } from "../../actions/ai-admin-actions";
import {
  uploadDocumentAction,
  createManualDocumentAction,
  deleteDocumentAction,
} from "../../actions/knowledge-actions";
import { KnowledgeDocItem, KnowledgeChunkItem } from "../../types";

interface AICopilotKnowledgeTabProps {
  initialKnowledgeDocs: KnowledgeDocItem[];
}

export function AICopilotKnowledgeTab({
  initialKnowledgeDocs,
}: AICopilotKnowledgeTabProps) {
  const [knowledgeDocs, setKnowledgeDocs] = React.useState(initialKnowledgeDocs);
  const [isSyncingKnowledge, setIsSyncingKnowledge] = React.useState(false);
  const [docUploadModalOpen, setDocUploadModalOpen] = React.useState(false);
  const [docUploadTab, setDocUploadTab] = React.useState<"file" | "manual">("file");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [docTitle, setDocTitle] = React.useState("");
  const [docCategory, setDocCategory] = React.useState("sop");
  const [docManualContent, setDocManualContent] = React.useState("");
  const [isSubmittingDoc, setIsSubmittingDoc] = React.useState(false);

  const [selectedDocForChunks, setSelectedDocForChunks] = React.useState<KnowledgeDocItem | null>(null);
  const [docChunks, setDocChunks] = React.useState<KnowledgeChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = React.useState(false);
  const [chunksModalOpen, setChunksModalOpen] = React.useState(false);

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
        const cleanName = f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Danh sách tài liệu đã được Index</h3>
          <p className="text-xs text-muted-foreground">
            Các tài liệu này được AI sử dụng để trả lời câu hỏi nghiệp vụ.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncKnowledge}
            disabled={isSyncingKnowledge}
            className="flex-1 sm:flex-none gap-2 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isSyncingKnowledge ? "animate-spin" : ""}`} />
            <span>Đồng bộ</span>
          </Button>
          <Button
            size="sm"
            onClick={handleOpenDocModal}
            className="flex-1 sm:flex-none gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>Nạp tài liệu mới</span>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b">
              <tr>
                <th className="px-4 py-3">Tên tài liệu / Tiêu đề</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3 text-center">Chunks</th>
                <th className="px-4 py-3">Vector Hash</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {knowledgeDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Chưa có tài liệu nào trong cơ sở tri thức.
                  </td>
                </tr>
              ) : (
                knowledgeDocs.map((doc) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
}
