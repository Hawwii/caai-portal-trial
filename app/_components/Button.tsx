import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
};

export default function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      className="text-xl bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 cursor-pointer rounded disabled:bg-gray-400 disabled:cursor-default"
      {...props}
    >
      {children}
    </button>
  );
}