'use client';

import { useState } from 'react';

interface ChatListFooterProps {
  isCollapsed: boolean;
  onDeleteAllChats: () => void;
  hasChats: boolean;
}

export default function ChatListFooter({
  isCollapsed,
  onDeleteAllChats,
  hasChats,
}: ChatListFooterProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteAll = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    onDeleteAllChats();
    setShowConfirm(false);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (!hasChats) return null;

  return (
    <div className="p-4 border-t border-gray-200 bg-white">
      {!isCollapsed && !showConfirm && (
        <button
          onClick={handleDeleteAll}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete All Chats
        </button>
      )}

      {!isCollapsed && showConfirm && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 text-center font-medium">
            Delete all chats?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAll}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {isCollapsed && (
        <button
          onClick={handleDeleteAll}
          className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
          title="Delete All Chats"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
