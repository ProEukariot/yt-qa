interface ErrorDisplayProps {
  error: string;
}

export default function ErrorDisplay({ error }: ErrorDisplayProps) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
      <p className="text-red-800 text-sm">{error}</p>
    </div>
  );
}
