"use client";

import * as React from "react";
import {
  Cpu,
  Save,
  MessageSquare,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateAiModelSettings } from "../../actions/ai-admin-actions";

interface AICopilotSettingsTabProps {
  initialSettings: {
    ai_model: string;
    ai_max_tokens: number;
  };
  totalConversations: number;
  totalKnowledgeDocs: number;
}

export function AICopilotSettingsTab({
  initialSettings,
  totalConversations,
  totalKnowledgeDocs,
}: AICopilotSettingsTabProps) {
  const [aiModel, setAiModel] = React.useState(initialSettings.ai_model);
  const [maxTokens, setMaxTokens] = React.useState(initialSettings.ai_max_tokens);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);

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

  return (
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
          <div className="text-2xl font-bold text-foreground">{totalConversations}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Được ghi nhận trên cơ sở dữ liệu</p>
        </Card>

        <Card className="p-4 bg-linear-to-br from-amber-500/5 to-muted border-amber-500/20">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Tài liệu SOP đã Index</span>
            <Layers className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalKnowledgeDocs}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Đã phân đoạn Vector & FTS</p>
        </Card>
      </div>
    </div>
  );
}
