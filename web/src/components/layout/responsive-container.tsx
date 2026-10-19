import React from 'react';

interface ResponsivePageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsivePageContainer({
  children,
  className = '',
}: ResponsivePageContainerProps) {
  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-5 sm:space-y-6 w-full min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8 ${className}`}
    >
      {children}
    </div>
  );
}
