interface EmptyStateProps {
  onCreateChat: () => void;
}

export default function EmptyState({ onCreateChat }: EmptyStateProps) {
  return (
    <div className="max-w-4xl mx-auto text-center py-20">
      <h1 className="text-4xl font-bold text-gray-900 mb-3">
        YouTube Q&A
      </h1>
      <p className="text-gray-600 text-lg mb-8">
        Ask questions about any YouTube video
      </p>
      <button
        onClick={onCreateChat}
        className="bg-gray-900 text-white py-3 px-8 rounded-lg font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create New Chat
      </button>
    </div>
  );
}
