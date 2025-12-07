import { ChatData, Message, StreamingStatus } from '@/app/types/chat';
import { Chat } from '@/app/components/ChatList';

export function updateChatDataField<K extends keyof ChatData>(
  chatData: Record<string, ChatData>,
  chatId: string,
  field: K,
  value: ChatData[K]
): Record<string, ChatData> {
  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      [field]: value,
    }
  };
}

export function updateMultipleChatDataFields(
  chatData: Record<string, ChatData>,
  chatId: string,
  updates: Partial<ChatData>
): Record<string, ChatData> {
  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      ...updates,
    }
  };
}

export function addMessageToChatData(
  chatData: Record<string, ChatData>,
  chatId: string,
  message: Message
): Record<string, ChatData> {
  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      messages: [...(chatData[chatId]?.messages || []), message],
    }
  };
}

export function updateLastMessage(
  chatData: Record<string, ChatData>,
  chatId: string,
  content: string
): Record<string, ChatData> {
  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      messages: chatData[chatId].messages.map((msg, idx) =>
        idx === chatData[chatId].messages.length - 1 && msg.isStreaming
          ? { ...msg, content }
          : msg
      ),
    }
  };
}

export function markMessagesAsComplete(
  chatData: Record<string, ChatData>,
  chatId: string
): Record<string, ChatData> {
  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      messages: chatData[chatId].messages.map(msg =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      ),
    }
  };
}

export function removeLastMessage(
  chatData: Record<string, ChatData>,
  chatId: string
): Record<string, ChatData> {
  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      messages: chatData[chatId].messages.slice(0, -1),
    }
  };
}

export function removeApprovalMessages(
  chatData: Record<string, ChatData>,
  chatId: string
): Record<string, ChatData> {
  const currentMessages = chatData[chatId]?.messages || [];
  const messagesWithoutApproval = currentMessages.filter(msg => msg.role !== 'approval');

  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      messages: messagesWithoutApproval,
    }
  };
}

export function updateStreamingStatus(
  chatData: Record<string, ChatData>,
  chatId: string,
  streamingStatus: StreamingStatus | undefined
): Record<string, ChatData> {
  return {
    ...chatData,
    [chatId]: {
      ...chatData[chatId],
      streamingStatus,
    }
  };
}

export function updateChatName(
  chats: Chat[],
  chatId: string,
  name: string,
  youtubeUrl?: string
): Chat[] {
  return chats.map(chat =>
    chat.id === chatId
      ? { ...chat, name, ...(youtubeUrl && { youtubeUrl }) }
      : chat
  );
}