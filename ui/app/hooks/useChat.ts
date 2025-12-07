import { useState } from 'react';
import { Chat } from '../components/ChatList';
import { ChatData, Message } from '../types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
  chatData: Record<string, ChatData>;
}

interface CurrentChatFormState {
  youtubeUrl: string;
  question: string;
  loading: boolean;
  preparingUrl: boolean;
  error: string | null;
  isProcessingApproval: boolean;
}

export function useChat() {
  const [chatState, setChatState] = useState<ChatState>({
    chats: [],
    currentChatId: null,
    chatData: {},
  });

  const [formState, setFormState] = useState<CurrentChatFormState>({
    youtubeUrl: '',
    question: '',
    loading: false,
    preparingUrl: false,
    error: null,
    isProcessingApproval: false,
  });

  const createNewChat = () => {
    const newChatId = `chat_${Date.now()}`;
    const newChat: Chat = {
      id: newChatId,
      name: `Chat ${chatState.chats.length + 1}`,
      createdAt: new Date(),
    };

    // Batch all state updates in a single transition to prevent multiple renders
    setChatState(prev => ({
      chats: [newChat, ...prev.chats],
      currentChatId: newChatId,
      chatData: {
        ...prev.chatData,
        [newChatId]: {
          messages: [],
          youtubeUrl: '',
          isPrepared: false,
          loading: false,
          preparingUrl: false,
          error: null,
          question: '',
        }
      }
    }));
    setFormState({
      youtubeUrl: '',
      question: '',
      loading: false,
      preparingUrl: false,
      error: null,
      isProcessingApproval: false,
    });
  };

  const selectChat = (chatId: string) => {
    setChatState(prev => ({ ...prev, currentChatId: chatId }));
    const data = chatState.chatData[chatId];
    if (data) {
      setFormState({
        youtubeUrl: data.youtubeUrl || '',
        question: data.question || '',
        loading: data.loading || false,
        preparingUrl: data.preparingUrl || false,
        error: data.error || null,
        isProcessingApproval: false,
      });
    } else {
      setFormState({
        youtubeUrl: '',
        question: '',
        loading: false,
        preparingUrl: false,
        error: null,
        isProcessingApproval: false,
      });
    }
  };

  const deleteChat = (chatId: string) => {
    const updatedChats = chatState.chats.filter(chat => chat.id !== chatId);
    const updatedChatData = { ...chatState.chatData };
    delete updatedChatData[chatId];

    setChatState(prev => ({
      chats: updatedChats,
      chatData: updatedChatData,
      currentChatId: prev.currentChatId === chatId ? null : prev.currentChatId,
    }));

    localStorage.setItem('chats', JSON.stringify(updatedChats));
    localStorage.setItem('chatData', JSON.stringify(updatedChatData));

    if (chatState.currentChatId === chatId) {
      setFormState({
        youtubeUrl: '',
        question: '',
        loading: false,
        preparingUrl: false,
        error: null,
        isProcessingApproval: false,
      });
    }
  };

  const deleteAllChats = () => {
    setChatState({
      chats: [],
      chatData: {},
      currentChatId: null,
    });
    setFormState({
      youtubeUrl: '',
      question: '',
      loading: false,
      preparingUrl: false,
      error: null,
      isProcessingApproval: false,
    });

    localStorage.removeItem('chats');
    localStorage.removeItem('chatData');
  };

  const handleYoutubeUrlChange = (value: string) => {
    setFormState(prev => ({ ...prev, youtubeUrl: value }));
    if (chatState.currentChatId) {
      setChatState(prev => ({
        ...prev,
        chatData: {
          ...prev.chatData,
          [prev.currentChatId!]: {
            ...prev.chatData[prev.currentChatId!],
            youtubeUrl: value,
          }
        }
      }));
    }
  };

  const handleQuestionChange = (value: string) => {
    setFormState(prev => ({ ...prev, question: value }));
    if (chatState.currentChatId) {
      setChatState(prev => ({
        ...prev,
        chatData: {
          ...prev.chatData,
          [prev.currentChatId!]: {
            ...prev.chatData[prev.currentChatId!],
            question: value,
          }
        }
      }));
    }
  };

  const handlePrepareUrl = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatState.currentChatId) {
      const errorMsg = 'Please create a chat first';
      setFormState(prev => ({ ...prev, error: errorMsg }));
      return;
    }

    const currentChatId = chatState.currentChatId;
    const youtubeUrl = formState.youtubeUrl;

    setFormState(prev => ({ ...prev, preparingUrl: true, error: null }));
    setChatState(prev => ({
      ...prev,
      chatData: {
        ...prev.chatData,
        [currentChatId]: {
          ...prev.chatData[currentChatId],
          preparingUrl: true,
          error: null,
        }
      }
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/upload-video/${currentChatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setChatState(prev => ({
          ...prev,
          chats: prev.chats.map(chat =>
            chat.id === currentChatId
              ? { ...chat, name: `Video Chat`, youtubeUrl }
              : chat
          ),
          chatData: {
            ...prev.chatData,
            [currentChatId]: {
              ...prev.chatData[currentChatId],
              youtubeUrl: youtubeUrl,
              isPrepared: true,
              preparingUrl: false,
            }
          }
        }));

        const systemMessage: Message = {
          role: 'assistant',
          content: `Video prepared successfully! ${data.num_chunks} chunks created from ${data.num_documents} documents.`,
          timestamp: new Date(),
        };

        setChatState(prev => ({
          ...prev,
          chatData: {
            ...prev.chatData,
            [currentChatId]: {
              ...prev.chatData[currentChatId],
              messages: [...(prev.chatData[currentChatId]?.messages || []), systemMessage],
            }
          }
        }));

        setFormState(prev => ({ ...prev, preparingUrl: false }));
      } else {
        const errorMsg = data.error || 'Failed to prepare URL';
        setFormState(prev => ({ ...prev, preparingUrl: false, error: errorMsg }));
        setChatState(prev => ({
          ...prev,
          chatData: {
            ...prev.chatData,
            [currentChatId]: {
              ...prev.chatData[currentChatId],
              preparingUrl: false,
              error: errorMsg,
            }
          }
        }));
      }
    } catch (err) {
      const errorMsg = 'Failed to connect to the API. Make sure the backend is running.';
      setFormState(prev => ({ ...prev, preparingUrl: false, error: errorMsg }));
      setChatState(prev => ({
        ...prev,
        chatData: {
          ...prev.chatData,
          [currentChatId]: {
            ...prev.chatData[currentChatId],
            preparingUrl: false,
            error: errorMsg,
          }
        }
      }));
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatState.currentChatId) {
      const errorMsg = 'Please create a chat first';
      setFormState(prev => ({ ...prev, error: errorMsg }));
      return;
    }

    const currentChatId = chatState.currentChatId;

    if (!chatState.chatData[currentChatId]?.isPrepared) {
      const errorMsg = 'Please prepare a YouTube URL first';
      setFormState(prev => ({ ...prev, error: errorMsg }));
      setChatState(prev => ({
        ...prev,
        chatData: {
          ...prev.chatData,
          [currentChatId]: {
            ...prev.chatData[currentChatId],
            error: errorMsg,
          }
        }
      }));
      return;
    }

    const currentQuestion = formState.question;

    setFormState(prev => ({ ...prev, loading: true, error: null, question: '' }));
    setChatState(prev => ({
      ...prev,
      chatData: {
        ...prev.chatData,
        [currentChatId]: {
          ...prev.chatData[currentChatId],
          loading: true,
          error: null,
          question: '',
          streamingStatus: { currentNode: null, nodeHistory: [] },
        }
      }
    }));

    const userMessage: Message = {
      role: 'user',
      content: currentQuestion,
      timestamp: new Date(),
    };

    setChatState(prev => ({
      ...prev,
      chatData: {
        ...prev.chatData,
        [currentChatId]: {
          ...prev.chatData[currentChatId],
          messages: [...(prev.chatData[currentChatId]?.messages || []), userMessage],
        }
      }
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/run/${currentChatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: currentQuestion }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamingMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      let messageAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'node_start') {
              // Update streaming status to show current node
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [currentChatId]: {
                    ...prev.chatData[currentChatId],
                    streamingStatus: {
                      currentNode: data.node,
                      nodeHistory: [...(prev.chatData[currentChatId]?.streamingStatus?.nodeHistory || []), data.node],
                    }
                  }
                }
              }));
            } else if (data.type === 'node_end') {
              // Node completed
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [currentChatId]: {
                    ...prev.chatData[currentChatId],
                    streamingStatus: {
                      ...prev.chatData[currentChatId].streamingStatus!,
                      currentNode: null,
                    }
                  }
                }
              }));
            } else if (data.type === 'token') {
              // Add streaming message if not already added
              if (!messageAdded) {
                setChatState(prev => ({
                  ...prev,
                  chatData: {
                    ...prev.chatData,
                    [currentChatId]: {
                      ...prev.chatData[currentChatId],
                      messages: [...(prev.chatData[currentChatId]?.messages || []), streamingMessage],
                    }
                  }
                }));
                messageAdded = true;
              }

              // Update streaming message content
              streamingMessage.content += data.content;
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [currentChatId]: {
                    ...prev.chatData[currentChatId],
                    messages: prev.chatData[currentChatId].messages.map((msg, idx) =>
                      idx === prev.chatData[currentChatId].messages.length - 1 && msg.isStreaming
                        ? { ...msg, content: streamingMessage.content }
                        : msg
                    ),
                  }
                }
              }));
            } else if (data.type === 'interrupted') {
              // Agent is waiting for approval
              const approvalMessage: Message = {
                role: 'approval',
                content: 'Approval required for tool execution',
                timestamp: new Date(),
                approvalData: {
                  question: data.interrupt_data.question,
                  tool_calls: data.interrupt_data.tool_calls,
                  threadId: currentChatId,
                }
              };

              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [currentChatId]: {
                    ...prev.chatData[currentChatId],
                    messages: messageAdded
                      ? [...prev.chatData[currentChatId].messages.slice(0, -1), approvalMessage]
                      : [...(prev.chatData[currentChatId]?.messages || []), approvalMessage],
                    loading: false,
                    streamingStatus: undefined,
                  }
                }
              }));
              setFormState(prev => ({ ...prev, loading: false }));
            } else if (data.type === 'completed') {
              // Mark streaming as complete
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [currentChatId]: {
                    ...prev.chatData[currentChatId],
                    messages: prev.chatData[currentChatId].messages.map(msg =>
                      msg.isStreaming ? { ...msg, isStreaming: false } : msg
                    ),
                    loading: false,
                    streamingStatus: undefined,
                  }
                }
              }));
              setFormState(prev => ({ ...prev, loading: false }));
            } else if (data.type === 'error') {
              const errorMsg = data.error || 'An error occurred';
              setFormState(prev => ({ ...prev, loading: false, error: errorMsg }));
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [currentChatId]: {
                    ...prev.chatData[currentChatId],
                    messages: messageAdded
                      ? prev.chatData[currentChatId].messages.slice(0, -1)
                      : prev.chatData[currentChatId].messages,
                    loading: false,
                    error: errorMsg,
                    streamingStatus: undefined,
                  }
                }
              }));
            }
          }
        }
      }
    } catch (err) {
      const errorMsg = 'Failed to connect to the API. Make sure the backend is running.';
      setFormState(prev => ({ ...prev, loading: false, error: errorMsg }));
      setChatState(prev => ({
        ...prev,
        chatData: {
          ...prev.chatData,
          [currentChatId]: {
            ...prev.chatData[currentChatId],
            messages: prev.chatData[currentChatId].messages.slice(0, -1),
            loading: false,
            error: errorMsg,
            streamingStatus: undefined,
          }
        }
      }));
    }
  };

  const handleApproval = async (threadId: string, approved: boolean) => {
    if (!threadId) return;

    setFormState(prev => ({ ...prev, isProcessingApproval: true, error: null }));

    // Remove the approval message first
    setChatState(prev => {
      const currentMessages = prev.chatData[threadId]?.messages || [];
      const messagesWithoutApproval = currentMessages.filter(msg => msg.role !== 'approval');

      return {
        ...prev,
        chatData: {
          ...prev.chatData,
          [threadId]: {
            ...prev.chatData[threadId],
            messages: messagesWithoutApproval,
            streamingStatus: { currentNode: null, nodeHistory: [] },
          }
        }
      };
    });

    try {
      const response = await fetch(`${API_BASE_URL}/resume/${threadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamingMessage: Message = {
        role: 'assistant',
        content: approved ? '' : 'Tool execution was rejected.',
        timestamp: new Date(),
        isStreaming: approved,
      };

      // Add initial message
      setChatState(prev => ({
        ...prev,
        chatData: {
          ...prev.chatData,
          [threadId]: {
            ...prev.chatData[threadId],
            messages: [...prev.chatData[threadId].messages, streamingMessage],
          }
        }
      }));

      if (!approved) {
        setFormState(prev => ({ ...prev, isProcessingApproval: false }));
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'node_start') {
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [threadId]: {
                    ...prev.chatData[threadId],
                    streamingStatus: {
                      currentNode: data.node,
                      nodeHistory: [...(prev.chatData[threadId]?.streamingStatus?.nodeHistory || []), data.node],
                    }
                  }
                }
              }));
            } else if (data.type === 'node_end') {
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [threadId]: {
                    ...prev.chatData[threadId],
                    streamingStatus: {
                      ...prev.chatData[threadId].streamingStatus!,
                      currentNode: null,
                    }
                  }
                }
              }));
            } else if (data.type === 'token') {
              streamingMessage.content += data.content;
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [threadId]: {
                    ...prev.chatData[threadId],
                    messages: prev.chatData[threadId].messages.map((msg, idx) =>
                      idx === prev.chatData[threadId].messages.length - 1 && msg.isStreaming
                        ? { ...msg, content: streamingMessage.content }
                        : msg
                    ),
                  }
                }
              }));
            } else if (data.type === 'completed') {
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [threadId]: {
                    ...prev.chatData[threadId],
                    messages: prev.chatData[threadId].messages.map(msg =>
                      msg.isStreaming ? { ...msg, isStreaming: false } : msg
                    ),
                    streamingStatus: undefined,
                  }
                }
              }));
              setFormState(prev => ({ ...prev, isProcessingApproval: false }));
            } else if (data.type === 'error') {
              const errorMsg = data.error || 'An error occurred';
              setFormState(prev => ({ ...prev, isProcessingApproval: false, error: errorMsg }));
              setChatState(prev => ({
                ...prev,
                chatData: {
                  ...prev.chatData,
                  [threadId]: {
                    ...prev.chatData[threadId],
                    streamingStatus: undefined,
                  }
                }
              }));
            }
          }
        }
      }
    } catch (err) {
      const errorMsg = 'Failed to connect to the API. Make sure the backend is running.';
      setFormState(prev => ({ ...prev, isProcessingApproval: false, error: errorMsg }));
      setChatState(prev => ({
        ...prev,
        chatData: {
          ...prev.chatData,
          [threadId]: {
            ...prev.chatData[threadId],
            streamingStatus: undefined,
          }
        }
      }));
    }
  };

  const handleApprove = (threadId: string) => handleApproval(threadId, true);
  const handleReject = (threadId: string) => handleApproval(threadId, false);

  return {
    chats: chatState.chats,
    setChats: (chats: Chat[]) => setChatState(prev => ({ ...prev, chats })),
    currentChatId: chatState.currentChatId,
    chatData: chatState.chatData,
    setChatData: (chatData: Record<string, ChatData>) => setChatState(prev => ({ ...prev, chatData })),
    youtubeUrl: formState.youtubeUrl,
    question: formState.question,
    loading: formState.loading,
    preparingUrl: formState.preparingUrl,
    error: formState.error,
    isProcessingApproval: formState.isProcessingApproval,
    createNewChat,
    selectChat,
    deleteChat,
    deleteAllChats,
    handleYoutubeUrlChange,
    handleQuestionChange,
    handlePrepareUrl,
    handleAskQuestion,
    handleApprove,
    handleReject,
  };
}
