import { useCallback } from 'react';
import { useChatState } from './chat/useChatState';
import { useChatForm } from './chat/useChatForm';
import { useChatAPI } from './chat/useChatAPI';
import { createUserMessage, createSystemMessage, createApprovalMessage } from '@/app/utils/chat/messageBuilder';
import { ToolCall } from '@/app/types/chat';

export function useChat() {
  const chatState = useChatState();
  const form = useChatForm();

  // API handlers
  const apiHandlers = {
    onPreparingStart: useCallback((chatId: string) => {
      form.setPreparingUrl(true);
      form.setError(null);
      chatState.updateChatDataFields(chatId, { preparingUrl: true, error: null });
    }, [form, chatState]),

    onPreparingSuccess: useCallback((chatId: string, youtubeUrl: string, numChunks: number, numDocuments: number) => {
      form.setPreparingUrl(false);
      chatState.updateChatMetadata(chatId, 'Video Chat', youtubeUrl);
      chatState.updateChatDataFields(chatId, {
        youtubeUrl,
        isPrepared: true,
        preparingUrl: false,
      });

      const systemMessage = createSystemMessage(
        `Video prepared successfully! ${numChunks} chunks created from ${numDocuments} documents.`
      );
      chatState.addMessage(chatId, systemMessage);
    }, [form, chatState]),

    onPreparingError: useCallback((chatId: string, error: string) => {
      form.setPreparingUrl(false);
      form.setError(error);
      chatState.updateChatDataFields(chatId, { preparingUrl: false, error });
    }, [form, chatState]),

    onQuestionStart: useCallback((chatId: string, question: string) => {
      form.setLoading(true);
      form.setError(null);
      form.clearQuestion();

      chatState.updateChatDataFields(chatId, {
        loading: true,
        error: null,
        question: '',
        streamingStatus: { currentNode: null, nodeHistory: [] },
      });

      const userMessage = createUserMessage(question);
      chatState.addMessage(chatId, userMessage);
    }, [form, chatState]),

    onNodeStart: useCallback((chatId: string, node: string) => {
      chatState.setStreamingStatus(chatId, {
        currentNode: node,
        nodeHistory: [...(chatState.chatData[chatId]?.streamingStatus?.nodeHistory || []), node],
      });
    }, [chatState]),

    onNodeEnd: useCallback((chatId: string) => {
      const currentStatus = chatState.chatData[chatId]?.streamingStatus;
      if (currentStatus) {
        chatState.setStreamingStatus(chatId, {
          ...currentStatus,
          currentNode: null,
        });
      }
    }, [chatState]),

    onToken: useCallback((chatId: string, content: string, messageAdded: boolean) => {
      if (!messageAdded) {
        const streamingMessage = createUserMessage('');
        streamingMessage.role = 'assistant';
        streamingMessage.isStreaming = true;
        chatState.addMessage(chatId, streamingMessage);
      }
      chatState.updateStreamingMessage(chatId, content);
    }, [chatState]),

    onInterrupted: useCallback((chatId: string, question: string, toolCalls: ToolCall[], messageAdded: boolean) => {
      if (messageAdded) {
        chatState.removeLastMsg(chatId);
      }

      const approvalMessage = createApprovalMessage({
        question,
        tool_calls: toolCalls,
        threadId: chatId,
      });

      chatState.addMessage(chatId, approvalMessage);
      chatState.updateChatDataFields(chatId, { loading: false, streamingStatus: undefined });
      form.setLoading(false);
    }, [chatState, form]),

    onCompleted: useCallback((chatId: string) => {
      chatState.completeStreaming(chatId);
      chatState.updateChatDataFields(chatId, { loading: false, streamingStatus: undefined });
      form.setLoading(false);
      form.setProcessingApproval(false);
    }, [chatState, form]),

    onError: useCallback((chatId: string, error: string, messageAdded: boolean) => {
      if (messageAdded) {
        chatState.removeLastMsg(chatId);
      }

      form.setLoading(false);
      form.setError(error);
      form.setProcessingApproval(false);
      chatState.updateChatDataFields(chatId, {
        loading: false,
        error,
        streamingStatus: undefined,
      });
    }, [chatState, form]),
  };

  const { handlePrepareUrl, handleAskQuestion, handleApproval } = useChatAPI(apiHandlers);

  // Form handlers
  const handleYoutubeUrlChange = useCallback((value: string) => {
    form.setYoutubeUrl(value);
    if (chatState.currentChatId) {
      chatState.updateChatDataFields(chatState.currentChatId, { youtubeUrl: value });
    }
  }, [form, chatState]);

  const handleQuestionChange = useCallback((value: string) => {
    form.setQuestion(value);
    if (chatState.currentChatId) {
      chatState.updateChatDataFields(chatState.currentChatId, { question: value });
    }
  }, [form, chatState]);

  // Chat actions
  const createNewChat = useCallback(() => {
    chatState.createNewChat();
    form.resetForm();
  }, [chatState, form]);

  const selectChat = useCallback((chatId: string) => {
    chatState.selectChat(chatId);
    const data = chatState.chatData[chatId];
    form.loadFromChatData(data);
  }, [chatState, form]);

  const deleteChat = useCallback((chatId: string) => {
    chatState.deleteChat(chatId);
    if (chatState.currentChatId === chatId) {
      form.resetForm();
    }
  }, [chatState, form]);

  const deleteAllChats = useCallback(() => {
    chatState.deleteAllChats();
    form.resetForm();
  }, [chatState, form]);

  // Form submit handlers
  const onPrepareUrl = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatState.currentChatId) {
      form.setError('Please create a chat first');
      return;
    }

    await handlePrepareUrl(chatState.currentChatId, form.youtubeUrl);
  }, [chatState.currentChatId, form, handlePrepareUrl]);

  const onAskQuestion = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatState.currentChatId) {
      form.setError('Please create a chat first');
      return;
    }

    if (!chatState.chatData[chatState.currentChatId]?.isPrepared) {
      form.setError('Please prepare a YouTube URL first');
      chatState.updateChatDataFields(chatState.currentChatId, {
        error: 'Please prepare a YouTube URL first',
      });
      return;
    }

    await handleAskQuestion(chatState.currentChatId, form.question);
  }, [chatState, form, handleAskQuestion]);

  // Approval handlers
  const onApprove = useCallback(async (threadId: string) => {
    form.setProcessingApproval(true);
    form.setError(null);
    chatState.removeApprovalMsg(threadId);
    chatState.setStreamingStatus(threadId, { currentNode: null, nodeHistory: [] });
    await handleApproval(threadId, true);
  }, [form, chatState, handleApproval]);

  const onReject = useCallback(async (threadId: string) => {
    form.setProcessingApproval(true);
    form.setError(null);
    chatState.removeApprovalMsg(threadId);
    chatState.setStreamingStatus(threadId, { currentNode: null, nodeHistory: [] });
    await handleApproval(threadId, false);
  }, [form, chatState, handleApproval]);

  return {
    chats: chatState.chats,
    setChats: chatState.setChats,
    currentChatId: chatState.currentChatId,
    chatData: chatState.chatData,
    setChatData: chatState.setChatData,
    youtubeUrl: form.youtubeUrl,
    question: form.question,
    loading: form.loading,
    preparingUrl: form.preparingUrl,
    error: form.error,
    isProcessingApproval: form.isProcessingApproval,
    createNewChat,
    selectChat,
    deleteChat,
    deleteAllChats,
    handleYoutubeUrlChange,
    handleQuestionChange,
    handlePrepareUrl: onPrepareUrl,
    handleAskQuestion: onAskQuestion,
    handleApprove: onApprove,
    handleReject: onReject,
  };
}