import React from 'react';
import { Badge } from './Badge';

interface PageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  isDemo?: boolean;
  breadcrumbs?: string[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
  isDemo = false,
  breadcrumbs,
}) => {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb}>
                {idx > 0 && <span>/</span>}
                <span className={idx === breadcrumbs.length - 1 ? 'font-medium text-slate-600' : ''}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {isDemo && (
            <Badge variant="warning" size="sm">
              Demo Preview
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500 max-w-3xl">{description}</p>
      </div>

      {action && <div className="shrink-0 flex items-center gap-2.5">{action}</div>}
    </div>
  );
};
