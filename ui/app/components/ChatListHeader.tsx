'use client';

interface ChatListHeaderProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCreateChat: () => void;
}

export default function ChatListHeader({
  isCollapsed,
  onToggleCollapse,
  onCreateChat,
}: ChatListHeaderProps) {
  return (
    <>
      {/* Collapse Toggle */}
      <div className="p-4 border-b border-gray-200 flex justify-end">
        <button
          onClick={onToggleCollapse}
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
    </>
  );
}
