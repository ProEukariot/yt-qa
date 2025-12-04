interface MessageInputProps {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function MessageInput({
  question,
  loading,
  onQuestionChange,
  onSubmit
}: MessageInputProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white z-10">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <form onSubmit={onSubmit} className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="Ask a question about the video..."
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
            disabled={loading}
            required
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="bg-gray-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
