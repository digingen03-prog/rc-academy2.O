import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white text-black">
      <div className="max-w-md text-center space-y-4">
        <span className="text-6xl font-black text-[#FF8500]">404</span>
        <h2 className="text-xl font-bold">Page Not Found</h2>
        <p className="text-sm text-neutral-500">
          The requested page could not be found or has been moved.
        </p>
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-bold rounded-lg transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
