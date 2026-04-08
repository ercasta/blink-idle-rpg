interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Running simulation…' }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-stone-100 gap-6">
      {/* Spinner */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-stone-700 rounded-full" />
        <div className="absolute inset-0 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-stone-400 text-sm">{message}</p>
    </div>
  );
}
