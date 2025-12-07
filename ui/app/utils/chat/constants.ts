export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const DEFAULT_FORM_STATE = {
  youtubeUrl: '',
  question: '',
  loading: false,
  preparingUrl: false,
  error: null,
  isProcessingApproval: false,
};

export const DEFAULT_CHAT_DATA = {
  messages: [],
  youtubeUrl: '',
  isPrepared: false,
  loading: false,
  preparingUrl: false,
  error: null,
  question: '',
};
