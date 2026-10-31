import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  onDismiss,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-rose-900 shadow-xs ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          {title && <h4 className="text-sm font-semibold text-rose-900">{title}</h4>}
          <p className="text-sm text-rose-700 mt-0.5">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 hover:text-rose-900 underline underline-offset-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-rose-400 hover:text-rose-600 transition-colors p-1 rounded-md hover:bg-rose-100/50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
