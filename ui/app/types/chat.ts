export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ApprovalData {
  question: string;
  tool_calls: ToolCall[];
  threadId: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'approval';
  content: string;
  timestamp: Date;
  approvalData?: ApprovalData;
}

export interface ChatData {
  messages: Message[];
  youtubeUrl: string;
  isPrepared: boolean;
  loading: boolean;
  preparingUrl: boolean;
  error: string | null;
  question: string;
}
