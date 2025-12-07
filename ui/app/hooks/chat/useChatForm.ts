import { useState, useCallback } from 'react';
import { DEFAULT_FORM_STATE } from '@/app/utils/chat/constants';
import { ChatData } from '@/app/types/chat';

interface FormState {
  youtubeUrl: string;
  question: string;
  loading: boolean;
  preparingUrl: boolean;
  error: string | null;
  isProcessingApproval: boolean;
}

export function useChatForm() {
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);

  const setYoutubeUrl = useCallback((value: string) => {
    setFormState(prev => ({ ...prev, youtubeUrl: value }));
  }, []);

  const setQuestion = useCallback((value: string) => {
    setFormState(prev => ({ ...prev, question: value }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setFormState(prev => ({ ...prev, loading }));
  }, []);

  const setPreparingUrl = useCallback((preparing: boolean) => {
    setFormState(prev => ({ ...prev, preparingUrl: preparing }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setFormState(prev => ({ ...prev, error }));
  }, []);

  const setProcessingApproval = useCallback((processing: boolean) => {
    setFormState(prev => ({ ...prev, isProcessingApproval: processing }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(DEFAULT_FORM_STATE);
  }, []);

  const loadFromChatData = useCallback((data: ChatData | undefined) => {
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
      resetForm();
    }
  }, [resetForm]);

  const clearQuestion = useCallback(() => {
    setFormState(prev => ({ ...prev, question: '' }));
  }, []);

  return {
    ...formState,
    setYoutubeUrl,
    setQuestion,
    setLoading,
    setPreparingUrl,
    setError,
    setProcessingApproval,
    resetForm,
    loadFromChatData,
    clearQuestion,
  };
}