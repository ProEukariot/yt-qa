'use client';

import { useState } from 'react';
import ChatListHeader from './ChatListHeader';
import ChatItem from './ChatItem';

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

export default function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  onCreateChat,
  onDeleteChat,
}: ChatListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`bg-white text-gray-900 transition-all duration-300 flex flex-col border-r border-gray-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <ChatListHeader
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onCreateChat={onCreateChat}
      />

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {chats.length === 0 && !isCollapsed ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No chats yet. Create one to get started!
            </div>
          ) : (
            chats.map((chat) => (
              <ChatItem
                key={chat.id}
                id={chat.id}
                name={chat.name}
                createdAt={chat.createdAt}
                isSelected={currentChatId === chat.id}
                isCollapsed={isCollapsed}
                onSelect={onSelectChat}
                onDelete={onDeleteChat}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
