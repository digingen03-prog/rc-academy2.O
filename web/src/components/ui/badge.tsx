import React from 'react';

interface BadgeProps {
  variant?: 'primary' | 'neutral' | 'outline' | 'dark' | 'muted' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full';

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 tracking-wider uppercase',
    md: 'text-xs px-2.5 py-0.5',
  };

  const variantStyles = {
    primary: 'bg-[#FFF4E5] text-[#CC6B00] border border-[#FFD199]',
    neutral: 'bg-neutral-100 text-neutral-800 border border-neutral-200',
    outline: 'bg-white text-neutral-700 border border-neutral-300',
    dark: 'bg-black text-white',
    muted: 'bg-neutral-50 text-neutral-600 border border-neutral-200',
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    error: 'bg-red-50 text-red-700 border border-red-200',
  };

  return (
    <span className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
