import { useEffect } from 'react';
import { Chat } from '../components/ChatList';
import { ChatData, Message } from '../types/chat';

export function useChatStorage(
  chats: Chat[],
  chatData: Record<string, ChatData>
) {
  // Load chats from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem('chats');
    const savedChatData = localStorage.getItem('chatData');

    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      return parsedChats.map((chat: Chat) => ({
        ...chat,
        createdAt: new Date(chat.createdAt)
      }));
    }

    if (savedChatData) {
      const parsedChatData = JSON.parse(savedChatData);
      const restoredChatData: Record<string, ChatData> = {};
      Object.keys(parsedChatData).forEach(key => {
        restoredChatData[key] = {
          ...parsedChatData[key],
          messages: parsedChatData[key].messages.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        };
      });
      return restoredChatData;
    }
  }, []);

  // Save chats to localStorage whenever they change
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('chats', JSON.stringify(chats));
    }
  }, [chats]);

  useEffect(() => {
    if (Object.keys(chatData).length > 0) {
      localStorage.setItem('chatData', JSON.stringify(chatData));
    }
  }, [chatData]);
}
