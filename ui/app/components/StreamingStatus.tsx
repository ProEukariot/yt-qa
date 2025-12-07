import { StreamingStatus as StreamingStatusType } from '../types/chat';

interface StreamingStatusProps {
  streamingStatus: StreamingStatusType;
}

const nodeDisplayNames: Record<string, string> = {
  retrieve: '📚 Retrieving context',
  generate: '🤖 Generating response',
  approval: '⏳ Waiting for approval',
  tools: '🔧 Executing tools',
};

const nodeDescriptions: Record<string, string> = {
  retrieve: 'Searching through video content for relevant information',
  generate: 'Creating response based on context',
  approval: 'Requesting permission to use external tools',
  tools: 'Running external tools to gather information',
};

export default function StreamingStatus({ streamingStatus }: StreamingStatusProps) {
  const { currentNode, nodeHistory } = streamingStatus;

  return (
    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 mr-8">
      <div className="flex items-start gap-3">
        <div className="font-semibold text-sm text-blue-700">Agent Status</div>
        <div className="flex-1">
          {currentNode && (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg text-blue-700">{nodeDisplayNames[currentNode] || `Running: ${currentNode}`}</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {nodeDescriptions[currentNode] || 'Processing...'}
              </p>
            </div>
          )}

          {nodeHistory.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-blue-600 font-medium mb-1">Execution Flow:</p>
              <div className="flex flex-wrap gap-2">
                {nodeHistory.map((node, idx) => (
                  <div
                    key={idx}
                    className={`text-xs px-2 py-1 rounded ${
                      node === currentNode
                        ? 'bg-blue-200 text-blue-800 font-semibold'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {nodeDisplayNames[node] || node}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
