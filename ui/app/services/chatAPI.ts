import { API_BASE_URL } from '@/app/utils/chat/constants';

export interface PrepareUrlResponse {
  num_chunks: number;
  num_documents: number;
  error?: string;
}

export async function prepareVideoUrl(chatId: string, url: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/upload-video/${chatId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
}

export async function askQuestion(chatId: string, question: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/run/${chatId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });
}

export async function resumeWithApproval(threadId: string, approved: boolean): Promise<Response> {
  return fetch(`${API_BASE_URL}/resume/${threadId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ approved }),
  });
}