import { Message } from '../types/chat';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: MessageListProps) {
  if (messages.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg ${
            message.role === 'user'
              ? 'bg-blue-50 border border-blue-200 ml-8'
              : 'bg-gray-50 border border-gray-200 mr-8'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`font-semibold text-sm ${
              message.role === 'user' ? 'text-blue-700' : 'text-gray-700'
            }`}>
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div className="flex-1">
              <p className="text-gray-900 whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs text-gray-500 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      ))}
      {loading && (
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 mr-8">
          <div className="flex items-start gap-3">
            <div className="font-semibold text-sm text-gray-700">Assistant</div>
            <div className="flex-1">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
