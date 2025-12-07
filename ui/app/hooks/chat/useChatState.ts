import { useState, useCallback } from 'react';
import { Chat } from '@/app/components/ChatList';
import { ChatData, Message, StreamingStatus } from '@/app/types/chat';
import { DEFAULT_CHAT_DATA } from '@/app/utils/chat/constants';
import {
  addMessageToChatData,
  updateLastMessage,
  markMessagesAsComplete,
  removeLastMessage,
  removeApprovalMessages,
  updateStreamingStatus,
  updateChatName,
  updateMultipleChatDataFields,
} from '@/app/utils/chat/chatStateUpdaters';

export function useChatState() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatData, setChatData] = useState<Record<string, ChatData>>({});

  const createNewChat = useCallback(() => {
    const newChatId = `chat_${Date.now()}`;
    const newChat: Chat = {
      id: newChatId,
      name: `Chat ${chats.length + 1}`,
      createdAt: new Date(),
    };

    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChatId);
    setChatData(prev => ({
      ...prev,
      [newChatId]: { ...DEFAULT_CHAT_DATA }
    }));

    return newChatId;
  }, [chats.length]);

  const selectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);

  const deleteChat = useCallback((chatId: string) => {
    setChats(prev => {
      const updatedChats = prev.filter(chat => chat.id !== chatId);
      localStorage.setItem('chats', JSON.stringify(updatedChats));
      return updatedChats;
    });

    setChatData(prev => {
      const updatedChatData = { ...prev };
      delete updatedChatData[chatId];
      localStorage.setItem('chatData', JSON.stringify(updatedChatData));
      return updatedChatData;
    });

    setCurrentChatId(prev => prev === chatId ? null : prev);
  }, []);

  const deleteAllChats = useCallback(() => {
    setChats([]);
    setChatData({});
    setCurrentChatId(null);
    localStorage.removeItem('chats');
    localStorage.removeItem('chatData');
  }, []);

  const addMessage = useCallback((chatId: string, message: Message) => {
    setChatData(prev => addMessageToChatData(prev, chatId, message));
  }, []);

  const updateStreamingMessage = useCallback((chatId: string, content: string) => {
    setChatData(prev => updateLastMessage(prev, chatId, content));
  }, []);

  const completeStreaming = useCallback((chatId: string) => {
    setChatData(prev => markMessagesAsComplete(prev, chatId));
  }, []);

  const removeLastMsg = useCallback((chatId: string) => {
    setChatData(prev => removeLastMessage(prev, chatId));
  }, []);

  const removeApprovalMsg = useCallback((chatId: string) => {
    setChatData(prev => removeApprovalMessages(prev, chatId));
  }, []);

  const setStreamingStatus = useCallback((chatId: string, status: StreamingStatus | undefined) => {
    setChatData(prev => updateStreamingStatus(prev, chatId, status));
  }, []);

  const updateChatMetadata = useCallback((chatId: string, name: string, youtubeUrl?: string) => {
    setChats(prev => updateChatName(prev, chatId, name, youtubeUrl));
  }, []);

  const updateChatDataFields = useCallback((chatId: string, updates: Partial<ChatData>) => {
    setChatData(prev => updateMultipleChatDataFields(prev, chatId, updates));
  }, []);

  return {
    chats,
    setChats,
    currentChatId,
    chatData,
    setChatData,
    createNewChat,
    selectChat,
    deleteChat,
    deleteAllChats,
    addMessage,
    updateStreamingMessage,
    completeStreaming,
    removeLastMsg,
    removeApprovalMsg,
    setStreamingStatus,
    updateChatMetadata,
    updateChatDataFields,
  };
}