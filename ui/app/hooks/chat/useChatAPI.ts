import { useCallback } from 'react';
import { prepareVideoUrl, askQuestion, resumeWithApproval } from '@/app/services/chatAPI';
import { useStreamReader } from './useStreamReader';
import { createAssistantMessage } from '@/app/utils/chat/messageBuilder';
import { ToolCall } from '@/app/types/chat';

interface ChatAPIHandlers {
  onPreparingStart: (chatId: string) => void;
  onPreparingSuccess: (chatId: string, youtubeUrl: string, numChunks: number, numDocuments: number) => void;
  onPreparingError: (chatId: string, error: string) => void;
  onQuestionStart: (chatId: string, question: string) => void;
  onNodeStart: (chatId: string, node: string) => void;
  onNodeEnd: (chatId: string) => void;
  onToken: (chatId: string, content: string, messageAdded: boolean) => void;
  onInterrupted: (chatId: string, question: string, toolCalls: ToolCall[], messageAdded: boolean) => void;
  onCompleted: (chatId: string) => void;
  onError: (chatId: string, error: string, messageAdded: boolean) => void;
}

export function useChatAPI(handlers: ChatAPIHandlers) {
  const { readStream } = useStreamReader();

  const handlePrepareUrl = useCallback(async (
    chatId: string,
    youtubeUrl: string
  ) => {
    handlers.onPreparingStart(chatId);

    try {
      const response = await prepareVideoUrl(chatId, youtubeUrl);
      const data = await response.json();

      if (response.ok) {
        handlers.onPreparingSuccess(chatId, youtubeUrl, data.num_chunks, data.num_documents);
      } else {
        handlers.onPreparingError(chatId, data.error || 'Failed to prepare URL');
      }
    } catch {
      handlers.onPreparingError(chatId, 'Failed to connect to the API. Make sure the backend is running.');
    }
  }, [handlers]);

  const handleAskQuestion = useCallback(async (
    chatId: string,
    question: string
  ) => {
    handlers.onQuestionStart(chatId, question);

    try {
      const response = await askQuestion(chatId, question);

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response');
      }

      let messageAdded = false;

      await readStream(response, chatId, {
        onNodeStart: (node: string) => handlers.onNodeStart(chatId, node),
        onNodeEnd: () => handlers.onNodeEnd(chatId),
        onToken: (content: string) => {
          handlers.onToken(chatId, content, messageAdded);
          messageAdded = true;
        },
        onInterrupted: (question: string, toolCalls: ToolCall[]) => {
          handlers.onInterrupted(chatId, question, toolCalls, messageAdded);
        },
        onCompleted: () => handlers.onCompleted(chatId),
        onError: (error: string) => handlers.onError(chatId, error, messageAdded),
      });
    } catch {
      handlers.onError(chatId, 'Failed to connect to the API. Make sure the backend is running.', false);
    }
  }, [handlers, readStream]);

  const handleApproval = useCallback(async (
    threadId: string,
    approved: boolean
  ) => {
    try {
      const response = await resumeWithApproval(threadId, approved);

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response');
      }

      const initialMessage = createAssistantMessage(
        approved ? '' : 'Tool execution was rejected.',
        approved
      );

      if (!approved) {
        handlers.onToken(threadId, initialMessage.content, false);
        return;
      }

      await readStream(response, threadId, {
        onNodeStart: (node: string) => handlers.onNodeStart(threadId, node),
        onNodeEnd: () => handlers.onNodeEnd(threadId),
        onToken: (content: string) => handlers.onToken(threadId, content, true),
        onInterrupted: (question: string, toolCalls: ToolCall[]) => {
          // This shouldn't happen during approval resume, but handle it
          handlers.onInterrupted(threadId, question, toolCalls, true);
        },
        onCompleted: () => handlers.onCompleted(threadId),
        onError: (error: string) => handlers.onError(threadId, error, true),
      }, initialMessage);
    } catch {
      handlers.onError(threadId, 'Failed to connect to the API. Make sure the backend is running.', false);
    }
  }, [handlers, readStream]);

  return {
    handlePrepareUrl,
    handleAskQuestion,
    handleApproval,
  };
}