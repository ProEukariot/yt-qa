'use client';

interface ChatItemProps {
  id: string;
  name: string;
  createdAt: Date;
  isSelected: boolean;
  isCollapsed: boolean;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
}

export default function ChatItem({
  id,
  name,
  createdAt,
  isSelected,
  isCollapsed,
  onSelect,
  onDelete,
}: ChatItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this chat?')) {
      onDelete(id);
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => onSelect(id)}
        className={`w-full p-3 rounded-lg ${
          isSelected
            ? 'bg-gray-900 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title={name}
      >
        <div className="w-5 h-5 mx-auto">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`group relative rounded-lg ${
        isSelected
          ? 'bg-gray-900 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <button
        onClick={() => onSelect(id)}
        className="w-full text-left p-3 pr-10"
      >
        <div className="font-medium truncate">{name}</div>
        <div
          className={`text-xs mt-1 ${
            isSelected ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          {new Date(createdAt).toLocaleDateString()}
        </div>
      </button>
      <button
        onClick={handleDelete}
        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 ${
          isSelected
            ? 'hover:bg-gray-800 text-gray-300 hover:text-white'
            : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
        }`}
        title="Delete chat"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}
