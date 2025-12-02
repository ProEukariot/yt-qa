interface PrepareUrlFormProps {
  youtubeUrl: string;
  preparingUrl: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function PrepareUrlForm({
  youtubeUrl,
  preparingUrl,
  onUrlChange,
  onSubmit
}: PrepareUrlFormProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Prepare YouTube Video
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 mb-2">
            YouTube URL
          </label>
          <input
            id="youtube-url"
            type="text"
            value={youtubeUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
            required
          />
        </div>
        <button
          type="submit"
          disabled={preparingUrl || !youtubeUrl}
          className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {preparingUrl ? 'Preparing...' : 'Prepare Video'}
        </button>
      </form>
    </div>
  );
}
