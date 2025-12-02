export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
