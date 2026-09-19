"use client";

import * as React from "react";
import {
  Bot,
  Sparkles,
  Sliders,
  MessageSquare,
  BookOpen,
  FilePlus2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { toggleAiSystem } from "../actions/ai-admin-actions";

import { AICopilotSessionsTab } from "./tabs/ai-copilot-sessions-tab";
import { AICopilotPromptsTab } from "./tabs/ai-copilot-prompts-tab";
import { AICopilotKnowledgeTab } from "./tabs/ai-copilot-knowledge-tab";
import { AICopilotSettingsTab } from "./tabs/ai-copilot-settings-tab";
import { AICopilotIngestTab } from "./tabs/ai-copilot-ingest-tab";
import {
  ConversationSession,
  QuickPromptItem,
  KnowledgeDocItem,
} from "../types";

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

export function AICopilotManager({
  initialSettings,
  initialQuickPrompts,
  initialConversations,
  initialKnowledgeDocs,
}: AICopilotManagerProps) {
  const [activeTab, setActiveTab] = React.useState<
    "sessions" | "ingest" | "knowledge" | "prompts" | "settings"
  >("sessions");
  const [aiEnabled, setAiEnabled] = React.useState(initialSettings.ai_enabled);
  const [knowledgeDocs, setKnowledgeDocs] = React.useState<KnowledgeDocItem[]>(initialKnowledgeDocs);

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

  const handleDocIngested = (newDoc: KnowledgeDocItem) => {
    setKnowledgeDocs((prev) => [newDoc, ...prev]);
  };

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
            Kiểm soát phiên đàm thoại, nạp và chuẩn hóa tài liệu tri thức SOP tự động và cấu hình mô hình AI Omniroute.
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
      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <Button
          variant={activeTab === "sessions" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("sessions")}
          className="gap-2 text-xs sm:text-sm shrink-0 whitespace-nowrap"
        >
          <MessageSquare className="size-4" />
          <span>Lịch sử đàm thoại ({initialConversations.length})</span>
        </Button>

        <Button
          variant={activeTab === "ingest" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("ingest")}
          className="gap-2 text-xs sm:text-sm shrink-0 whitespace-nowrap bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium"
        >
          <Sparkles className="size-4 text-primary" />
          <span>Trò chuyện nạp tri thức</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-primary/20 text-primary">Mới</Badge>
        </Button>

        <Button
          variant={activeTab === "knowledge" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("knowledge")}
          className="gap-2 text-xs sm:text-sm shrink-0 whitespace-nowrap"
        >
          <BookOpen className="size-4" />
          <span>Cơ sở tri thức SOP ({knowledgeDocs.length})</span>
        </Button>

        <Button
          variant={activeTab === "prompts" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("prompts")}
          className="gap-2 text-xs sm:text-sm shrink-0 whitespace-nowrap"
        >
          <FilePlus2 className="size-4" />
          <span>Gợi ý tra cứu nhanh ({initialQuickPrompts.length})</span>
        </Button>

        <Button
          variant={activeTab === "settings" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("settings")}
          className="gap-2 text-xs sm:text-sm shrink-0 whitespace-nowrap"
        >
          <Sliders className="size-4" />
          <span>Cấu hình & Model</span>
        </Button>
      </div>

      {activeTab === "sessions" && (
        <AICopilotSessionsTab initialConversations={initialConversations} />
      )}

      {activeTab === "ingest" && (
        <AICopilotIngestTab onDocIngested={handleDocIngested} />
      )}

      {activeTab === "knowledge" && (
        <AICopilotKnowledgeTab initialKnowledgeDocs={knowledgeDocs} />
      )}

      {activeTab === "prompts" && (
        <AICopilotPromptsTab initialQuickPrompts={initialQuickPrompts} />
      )}

      {activeTab === "settings" && (
        <AICopilotSettingsTab 
          initialSettings={initialSettings} 
          totalConversations={initialConversations.length}
          totalKnowledgeDocs={knowledgeDocs.length}
        />
      )}
    </div>
  );
}
