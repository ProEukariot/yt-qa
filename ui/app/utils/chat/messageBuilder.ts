import { Message, ApprovalData } from '@/app/types/chat';

export function createUserMessage(content: string): Message {
  return {
    role: 'user',
    content,
    timestamp: new Date(),
  };
}

export function createAssistantMessage(content: string, isStreaming: boolean = false): Message {
  return {
    role: 'assistant',
    content,
    timestamp: new Date(),
    isStreaming,
  };
}

export function createSystemMessage(content: string): Message {
  return {
    role: 'assistant',
    content,
    timestamp: new Date(),
  };
}

export function createApprovalMessage(approvalData: ApprovalData): Message {
  return {
    role: 'approval',
    content: 'Approval required for tool execution',
    timestamp: new Date(),
    approvalData,
  };
}
