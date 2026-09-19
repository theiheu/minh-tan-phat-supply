"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  PackageSearch,
  AlertTriangle,
  Fuel,
  BookOpen,
  Wrench,
  Shield,
  Tag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  upsertQuickPrompt,
  deleteQuickPrompt,
  type QuickPromptInput,
} from "../../actions/ai-admin-actions";
import { QuickPromptItem } from "../../types";

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

interface AICopilotPromptsTabProps {
  initialQuickPrompts: QuickPromptItem[];
}

export function AICopilotPromptsTab({
  initialQuickPrompts,
}: AICopilotPromptsTabProps) {
  const [quickPrompts, setQuickPrompts] = React.useState(initialQuickPrompts);
  const [promptDialogOpen, setPromptDialogOpen] = React.useState(false);
  const [editingPrompt, setEditingPrompt] = React.useState<QuickPromptInput | null>(null);

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

  const handleSavePrompt = async () => {
    if (!editingPrompt || !editingPrompt.label.trim() || !editingPrompt.prompt.trim()) {
      toast.error("Vui lòng nhập đầy đủ tiêu đề và nội dung câu hỏi mẫu.");
      return;
    }

     
    const res = await upsertQuickPrompt(editingPrompt as any);
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

  return (
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
                      <h4 className="font-semibold text-sm leading-none mb-1 text-foreground">
                        {p.label}
                      </h4>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                        Thứ tự: {p.display_order}
                        {!p.is_active && (
                          <span className="text-destructive lowercase border border-destructive px-1 py-0.5 rounded-sm">đang ẩn</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenPromptDialog(p)}
                      className="size-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePrompt(p.id)}
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {p.prompt}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

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
    </div>
  );
}
