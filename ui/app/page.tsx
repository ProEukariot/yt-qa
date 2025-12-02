'use client';

import { useState, useEffect } from 'react';
import ChatList, { Chat } from './components/ChatList';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatData {
  messages: Message[];
  youtubeUrl: string;
  isPrepared: boolean;
  loading: boolean;
  preparingUrl: boolean;
  error: string | null;
  question: string;
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatData, setChatData] = useState<Record<string, ChatData>>({});

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [preparingUrl, setPreparingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Load chats from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem('chats');
    const savedChatData = localStorage.getItem('chatData');

    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats.map((chat: Chat) => ({
        ...chat,
        createdAt: new Date(chat.createdAt)
      })));
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
      setChatData(restoredChatData);
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

  const createNewChat = () => {
    const newChatId = `chat_${Date.now()}`;
    const newChat: Chat = {
      id: newChatId,
      name: `Chat ${chats.length + 1}`,
      createdAt: new Date(),
    };

    setChats([newChat, ...chats]);
    setChatData({
      ...chatData,
      [newChatId]: {
        messages: [],
        youtubeUrl: '',
        isPrepared: false,
        loading: false,
        preparingUrl: false,
        error: null,
        question: '',
      }
    });
    setCurrentChatId(newChatId);
    setYoutubeUrl('');
    setError(null);
  };

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    const data = chatData[chatId];
    if (data) {
      // Restore all per-chat states
      setYoutubeUrl(data.youtubeUrl || '');
      setLoading(data.loading || false);
      setPreparingUrl(data.preparingUrl || false);
      setError(data.error || null);
      setQuestion(data.question || '');
    } else {
      // Reset to defaults if no data
      setYoutubeUrl('');
      setLoading(false);
      setPreparingUrl(false);
      setError(null);
      setQuestion('');
    }
  };

  const deleteChat = (chatId: string) => {
    // Remove chat from list
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);

    // Remove chat data
    const updatedChatData = { ...chatData };
    delete updatedChatData[chatId];
    setChatData(updatedChatData);

    // Update localStorage
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    localStorage.setItem('chatData', JSON.stringify(updatedChatData));

    // If the deleted chat was selected, clear selection
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setYoutubeUrl('');
      setLoading(false);
      setPreparingUrl(false);
      setError(null);
      setQuestion('');
    }
  };

  const handleYoutubeUrlChange = (value: string) => {
    setYoutubeUrl(value);
    if (currentChatId) {
      setChatData(prev => ({
        ...prev,
        [currentChatId]: {
          ...prev[currentChatId],
          youtubeUrl: value,
        }
      }));
    }
  };

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
    if (currentChatId) {
      setChatData(prev => ({
        ...prev,
        [currentChatId]: {
          ...prev[currentChatId],
          question: value,
        }
      }));
    }
  };

  const handlePrepareUrl = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentChatId) {
      const errorMsg = 'Please create a chat first';
      setError(errorMsg);
      setChatData(prev => ({
        ...prev,
        [currentChatId!]: {
          ...prev[currentChatId!],
          error: errorMsg,
        }
      }));
      return;
    }

    setPreparingUrl(true);
    setError(null);

    // Update per-chat state
    setChatData(prev => ({
      ...prev,
      [currentChatId]: {
        ...prev[currentChatId],
        preparingUrl: true,
        error: null,
      }
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/prepare-url/${currentChatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update chat data
        setChatData(prev => ({
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            youtubeUrl: youtubeUrl,
            isPrepared: true,
            preparingUrl: false,
          }
        }));

        // Update chat name to include video info
        setChats(chats.map(chat =>
          chat.id === currentChatId
            ? { ...chat, name: `Video Chat`, youtubeUrl }
            : chat
        ));

        // Add system message
        const systemMessage: Message = {
          role: 'assistant',
          content: `Video prepared successfully! ${data.num_chunks} chunks created from ${data.num_documents} documents.`,
          timestamp: new Date(),
        };

        setChatData(prev => ({
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            messages: [...(prev[currentChatId]?.messages || []), systemMessage],
          }
        }));
      } else {
        const errorMsg = data.error || 'Failed to prepare URL';
        setError(errorMsg);
        setChatData(prev => ({
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            preparingUrl: false,
            error: errorMsg,
          }
        }));
      }
    } catch (err) {
      const errorMsg = 'Failed to connect to the API. Make sure the backend is running.';
      setError(errorMsg);
      setChatData(prev => ({
        ...prev,
        [currentChatId]: {
          ...prev[currentChatId],
          preparingUrl: false,
          error: errorMsg,
        }
      }));
    } finally {
      setPreparingUrl(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentChatId) {
      const errorMsg = 'Please create a chat first';
      setError(errorMsg);
      return;
    }

    if (!chatData[currentChatId]?.isPrepared) {
      const errorMsg = 'Please prepare a YouTube URL first';
      setError(errorMsg);
      setChatData(prev => ({
        ...prev,
        [currentChatId]: {
          ...prev[currentChatId],
          error: errorMsg,
        }
      }));
      return;
    }

    setLoading(true);
    setError(null);

    // Update per-chat state
    setChatData(prev => ({
      ...prev,
      [currentChatId]: {
        ...prev[currentChatId],
        loading: true,
        error: null,
        question: '',
      }
    }));

    // Add user message immediately
    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setChatData(prev => ({
      ...prev,
      [currentChatId]: {
        ...prev[currentChatId],
        messages: [...(prev[currentChatId]?.messages || []), userMessage],
      }
    }));

    const currentQuestion = question;
    setQuestion('');

    try {
      const response = await fetch(`${API_BASE_URL}/ask/${currentChatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: currentQuestion }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.answer,
          timestamp: new Date(),
        };

        setChatData(prev => ({
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            messages: [...(prev[currentChatId]?.messages || []), assistantMessage],
            loading: false,
          }
        }));
      } else {
        const errorMsg = data.error || 'Failed to get answer';
        setError(errorMsg);
        // Remove the user message on error
        setChatData(prev => ({
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            messages: prev[currentChatId].messages.slice(0, -1),
            loading: false,
            error: errorMsg,
          }
        }));
      }
    } catch (err) {
      const errorMsg = 'Failed to connect to the API. Make sure the backend is running.';
      setError(errorMsg);
      // Remove the user message on error
      setChatData(prev => ({
        ...prev,
        [currentChatId]: {
          ...prev[currentChatId],
          messages: prev[currentChatId].messages.slice(0, -1),
          loading: false,
          error: errorMsg,
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const currentMessages = currentChatId ? chatData[currentChatId]?.messages || [] : [];
  const isPrepared = currentChatId ? chatData[currentChatId]?.isPrepared || false : false;

  return (
    <div className="min-h-screen bg-white flex">
      {/* Chat List Sidebar */}
      <ChatList
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        onCreateChat={createNewChat}
        onDeleteChat={deleteChat}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-12">
          {!currentChatId ? (
            <div className="max-w-4xl mx-auto text-center py-20">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                YouTube Q&A
              </h1>
              <p className="text-gray-600 text-lg mb-8">
                Ask questions about any YouTube video
              </p>
              <button
                onClick={createNewChat}
                className="bg-gray-900 text-white py-3 px-8 rounded-lg font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Chat
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  YouTube Q&A
                </h1>
                {chatData[currentChatId]?.youtubeUrl && (
                  <p className="text-sm text-gray-500">
                    Chatting about: {chatData[currentChatId].youtubeUrl}
                  </p>
                )}
              </div>

              {/* Prepare URL Section */}
              {!isPrepared && (
                <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Prepare YouTube Video
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
                        onChange={(e) => handleYoutubeUrlChange(e.target.value)}
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
              )}

              {/* Messages */}
              {currentMessages.length > 0 && (
                <div className="space-y-4 mb-6">
                  {currentMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-50 border border-blue-200 ml-8'
                          : 'bg-gray-50 border border-gray-200 mr-8'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`font-semibold text-sm ${
                          message.role === 'user' ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-900 whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 mr-8">
                      <div className="flex items-start gap-3">
                        <div className="font-semibold text-sm text-gray-700">Assistant</div>
                        <div className="flex-1">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Question Input - Fixed at bottom */}
        {currentChatId && isPrepared && (
          <div className="border-t border-gray-200 bg-white">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <form onSubmit={handleAskQuestion} className="flex gap-3">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => handleQuestionChange(e.target.value)}
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
        )}
      </div>
    </div>
  );
}
