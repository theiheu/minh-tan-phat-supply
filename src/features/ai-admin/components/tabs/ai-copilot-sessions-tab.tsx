"use client";

import * as React from "react";
import {
  Search,
  MessageSquare,
  User,
  ChevronRight,
  Trash2,
  Bot,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteConversationAction } from "../../actions/ai-admin-actions";
import { AIMarkdown } from "@/components/ai/ai-markdown";
import { roleLabel } from "@/lib/labels";
import type { Role } from "@/lib/types";
import { ConversationSession, ConversationMessage } from "../../types";

interface AICopilotSessionsTabProps {
  initialConversations: ConversationSession[];
}

export function AICopilotSessionsTab({
  initialConversations,
}: AICopilotSessionsTabProps) {
  const [conversations, setConversations] = React.useState(initialConversations);
  const [sessionSearch, setSessionSearch] = React.useState("");
  const [selectedConversation, setSelectedConversation] = React.useState<ConversationSession | null>(null);
  const [messagesModalOpen, setMessagesModalOpen] = React.useState(false);
  const [activeMessages, setActiveMessages] = React.useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);

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

  const filteredConversations = conversations.filter(
    (c) =>
      c.user_name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  return (
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
