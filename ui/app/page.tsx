'use client';

import { useState } from 'react';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [preparingUrl, setPreparingUrl] = useState(false);
  const [prepareStatus, setPrepareStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handlePrepareUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreparingUrl(true);
    setError(null);
    setPrepareStatus(null);

    // Extract video ID from YouTube URL or use custom ID
    const urlVideoId = youtubeUrl.match(/(?:v=|\/)([\w-]{11})/)?.[1] || `video_${Date.now()}`;
    setVideoId(urlVideoId);

    try {
      const response = await fetch(`${API_BASE_URL}/prepare-url/${urlVideoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setPrepareStatus(`Video prepared successfully! ${data.num_chunks} chunks created.`);
      } else {
        setError(data.error || 'Failed to prepare URL');
      }
    } catch (err) {
      setError('Failed to connect to the API. Make sure the backend is running.');
    } finally {
      setPreparingUrl(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoId) {
      setError('Please prepare a YouTube URL first');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          video_id: videoId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnswer(data.answer);
      } else {
        setError(data.error || 'Failed to get answer');
      }
    } catch (err) {
      setError('Failed to connect to the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            YouTube Q&A
          </h1>
          <p className="text-gray-600 text-lg">
            Ask questions about any YouTube video
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Step 1: Prepare URL */}
          <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 1: Prepare YouTube Video
            </h2>
            <form onSubmit={handlePrepareUrl} className="space-y-4">
              <div>
                <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube URL
                </label>
                <input
                  id="youtube-url"
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
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
            {prepareStatus && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">{prepareStatus}</p>
              </div>
            )}
          </div>

          {/* Step 2: Ask Questions */}
          <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 2: Ask a Question
            </h2>
            <form onSubmit={handleAskQuestion} className="space-y-4">
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Question
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What is this video about?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-gray-900"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !question || !videoId}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Getting Answer...' : 'Ask Question'}
              </button>
            </form>

            {/* Answer Display */}
            {answer && (
              <div className="mt-6 p-6 bg-white rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Answer:</h3>
                <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{answer}</p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Make sure the FastAPI backend is running on port 8000</p>
        </div>
      </div>
    </div>
  );
}
