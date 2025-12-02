import { useState } from 'react';
import { Chat } from '../components/ChatList';
import { ChatData, Message } from '../types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatData, setChatData] = useState<Record<string, ChatData>>({});

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [preparingUrl, setPreparingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setYoutubeUrl(data.youtubeUrl || '');
      setLoading(data.loading || false);
      setPreparingUrl(data.preparingUrl || false);
      setError(data.error || null);
      setQuestion(data.question || '');
    } else {
      setYoutubeUrl('');
      setLoading(false);
      setPreparingUrl(false);
      setError(null);
      setQuestion('');
    }
  };

  const deleteChat = (chatId: string) => {
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);

    const updatedChatData = { ...chatData };
    delete updatedChatData[chatId];
    setChatData(updatedChatData);

    localStorage.setItem('chats', JSON.stringify(updatedChats));
    localStorage.setItem('chatData', JSON.stringify(updatedChatData));

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
        setChatData(prev => ({
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            youtubeUrl: youtubeUrl,
            isPrepared: true,
            preparingUrl: false,
          }
        }));

        setChats(chats.map(chat =>
          chat.id === currentChatId
            ? { ...chat, name: `Video Chat`, youtubeUrl }
            : chat
        ));

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

    setChatData(prev => ({
      ...prev,
      [currentChatId]: {
        ...prev[currentChatId],
        loading: true,
        error: null,
        question: '',
      }
    }));

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

  return {
    chats,
    setChats,
    currentChatId,
    chatData,
    setChatData,
    youtubeUrl,
    question,
    loading,
    preparingUrl,
    error,
    createNewChat,
    selectChat,
    deleteChat,
    handleYoutubeUrlChange,
    handleQuestionChange,
    handlePrepareUrl,
    handleAskQuestion,
  };
}
