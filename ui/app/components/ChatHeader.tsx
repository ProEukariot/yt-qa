interface ChatHeaderProps {
  youtubeUrl?: string;
}

export default function ChatHeader({ youtubeUrl }: ChatHeaderProps) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        YouTube Q&A
      </h1>
      {youtubeUrl && (
        <p className="text-sm text-gray-500">
          Chatting about: {youtubeUrl}
        </p>
      )}
    </div>
  );
}
