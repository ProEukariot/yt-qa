import { useCallback } from 'react';
import { Message, ToolCall } from '@/app/types/chat';
import { createAssistantMessage } from '@/app/utils/chat/messageBuilder';

export interface StreamEvent {
  type: 'node_start' | 'node_end' | 'token' | 'interrupted' | 'completed' | 'error';
  node?: string;
  content?: string;
  error?: string;
  interrupt_data?: {
    question: string;
    tool_calls: ToolCall[];
  };
}

interface StreamHandlers {
  onNodeStart: (node: string) => void;
  onNodeEnd: () => void;
  onToken: (content: string) => void;
  onInterrupted: (question: string, toolCalls: ToolCall[], threadId: string) => void;
  onCompleted: () => void;
  onError: (error: string) => void;
}

export function useStreamReader() {
  const readStream = useCallback(async (
    response: Response,
    threadId: string,
    handlers: StreamHandlers,
    initialMessage?: Message
  ) => {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const streamingMessage = initialMessage || createAssistantMessage('', true);
    let messageAdded = !!initialMessage;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data: StreamEvent = JSON.parse(line.slice(6));

          switch (data.type) {
            case 'node_start':
              if (data.node) {
                handlers.onNodeStart(data.node);
              }
              break;

            case 'node_end':
              handlers.onNodeEnd();
              break;

            case 'token':
              if (data.content) {
                if (!messageAdded) {
                  handlers.onToken(streamingMessage.content);
                  messageAdded = true;
                }
                streamingMessage.content += data.content;
                handlers.onToken(streamingMessage.content);
              }
              break;

            case 'interrupted':
              if (data.interrupt_data) {
                handlers.onInterrupted(
                  data.interrupt_data.question,
                  data.interrupt_data.tool_calls,
                  threadId
                );
              }
              break;

            case 'completed':
              handlers.onCompleted();
              break;

            case 'error':
              handlers.onError(data.error || 'An error occurred');
              break;
          }
        }
      }
    }

    return { streamingMessage, messageAdded };
  }, []);

  return { readStream };
}