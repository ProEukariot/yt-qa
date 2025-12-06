'use client';

import { useEffect } from 'react';
import ChatList from './components/ChatList';
import ChatHeader from './components/ChatHeader';
import EmptyState from './components/EmptyState';
import PrepareUrlForm from './components/PrepareUrlForm';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import ErrorDisplay from './components/ErrorDisplay';
import { useChat } from './hooks/useChat';
import { Message } from './types/chat';

export default function Home() {
  const {
    chats,
    setChats,
    currentChatId,
    chatData,
    setChatData,
    youtubeUrl,
    question,
    loading,
    preparingUrl,
    error,
    isProcessingApproval,
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
  } = useChat();

  // Load chats from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem('chats');
    const savedChatData = localStorage.getItem('chatData');

    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats.map((chat: any) => ({
        ...chat,
        createdAt: new Date(chat.createdAt)
      })));
    }

    if (savedChatData) {
      const parsedChatData = JSON.parse(savedChatData);
      const restoredChatData: Record<string, any> = {};
      Object.keys(parsedChatData).forEach(key => {
        restoredChatData[key] = {
          ...parsedChatData[key],
          messages: parsedChatData[key].messages.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        };
      });
      setChatData(restoredChatData);
    }
  }, []);

  // Save chats and chatData to localStorage whenever they change
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('chats', JSON.stringify(chats));
    }
    if (Object.keys(chatData).length > 0) {
      localStorage.setItem('chatData', JSON.stringify(chatData));
    }
  }, [chats, chatData]);

  const currentMessages = currentChatId ? chatData[currentChatId]?.messages || [] : [];
  const isPrepared = currentChatId ? chatData[currentChatId]?.isPrepared || false : false;

  return (
    <div className="min-h-screen bg-white flex">
      <ChatList
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        onCreateChat={createNewChat}
        onDeleteChat={deleteChat}
        onDeleteAllChats={deleteAllChats}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-12 pb-24">
          {!currentChatId ? (
            <EmptyState onCreateChat={createNewChat} />
          ) : (
            <div className="max-w-4xl mx-auto">
              <ChatHeader youtubeUrl={chatData[currentChatId]?.youtubeUrl} />

              {!isPrepared && (
                <PrepareUrlForm
                  youtubeUrl={youtubeUrl}
                  preparingUrl={preparingUrl}
                  onUrlChange={handleYoutubeUrlChange}
                  onSubmit={handlePrepareUrl}
                />
              )}

              <MessageList
                messages={currentMessages}
                loading={loading}
                onApprove={handleApprove}
                onReject={handleReject}
                isProcessingApproval={isProcessingApproval}
              />

              {error && <ErrorDisplay error={error} />}
            </div>
          )}
        </div>
      </div>

      {currentChatId && isPrepared && (
        <MessageInput
          question={question}
          loading={loading}
          onQuestionChange={handleQuestionChange}
          onSubmit={handleAskQuestion}
        />
      )}
    </div>
  );
}
