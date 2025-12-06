import { ApprovalData } from '../types/chat';

interface ApprovalRequestProps {
  approvalData: ApprovalData;
  onApprove: (threadId: string) => void;
  onReject: (threadId: string) => void;
  isProcessing: boolean;
}

export default function ApprovalRequest({
  approvalData,
  onApprove,
  onReject,
  isProcessing
}: ApprovalRequestProps) {
  return (
    <div className="p-4 rounded-lg bg-yellow-50 border-2 border-yellow-300 mr-8">
      <div className="flex items-start gap-3">
        <div className="font-semibold text-sm text-yellow-800">Approval Required</div>
        <div className="flex-1">
          <p className="text-gray-900 mb-3">{approvalData.question}</p>

          <div className="bg-white rounded-lg p-3 mb-4 border border-yellow-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Tool Calls to Execute:</p>
            {approvalData.tool_calls.map((toolCall, index) => (
              <div key={index} className="mb-3 last:mb-0">
                <p className="text-sm font-medium text-blue-700 mb-1">
                  {index + 1}. {toolCall.name}
                </p>
                <div className="bg-gray-50 rounded p-2 text-xs font-mono overflow-x-auto">
                  <pre className="text-gray-700">
                    {JSON.stringify(toolCall.args, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onApprove(approvalData.threadId)}
              disabled={isProcessing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {isProcessing ? 'Processing...' : 'Approve & Execute'}
            </button>
            <button
              onClick={() => onReject(approvalData.threadId)}
              disabled={isProcessing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
