import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8500] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-[#FF8500] hover:bg-[#E67700] text-white shadow-subtle',
    secondary: 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-200',
    outline: 'bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 hover:border-neutral-400',
    ghost: 'bg-transparent hover:bg-neutral-100 text-neutral-700',
    danger: 'bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-300 hover:border-neutral-900',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
