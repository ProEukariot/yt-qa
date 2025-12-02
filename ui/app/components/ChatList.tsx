'use client';

import { useState } from 'react';

export interface Chat {
  id: string;
  name: string;
  youtubeUrl?: string;
  createdAt: Date;
}

interface ChatListProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export default function ChatList({ chats, currentChatId, onSelectChat, onCreateChat, onDeleteChat }: ChatListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleDelete = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this chat?')) {
      onDeleteChat(chatId);
    }
  };

  return (
    <div className={`bg-white text-gray-900 transition-all duration-300 flex flex-col border-r border-gray-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Collapse Toggle */}
      <div className="p-4 border-b border-gray-200 flex justify-end">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-600 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Header with Create Chat Button */}
      <div className="p-4 border-b border-gray-200">
        {!isCollapsed && (
          <button
            onClick={onCreateChat}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={onCreateChat}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
            title="New Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="p-2 space-y-1">
            {chats.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No chats yet. Create one to get started!
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative rounded-lg transition-colors ${
                    currentChatId === chat.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    className="w-full text-left p-3 pr-10"
                  >
                    <div className="font-medium truncate">{chat.name}</div>
                    <div className={`text-xs mt-1 ${
                      currentChatId === chat.id ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {new Date(chat.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, chat.id)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                      currentChatId === chat.id
                        ? 'hover:bg-gray-800 text-gray-300 hover:text-white'
                        : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
                    }`}
                    title="Delete chat"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {isCollapsed && chats.length > 0 && (
          <div className="p-2 space-y-1">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full p-3 rounded-lg transition-colors ${
                  currentChatId === chat.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={chat.name}
              >
                <div className="w-5 h-5 mx-auto">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
