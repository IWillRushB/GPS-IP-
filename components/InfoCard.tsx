import React from 'react';

interface InfoCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({ title, icon, children, loading, className = "" }) => {
  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-5 shadow-lg flex flex-col h-full ${className}`}>
      <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3">
        <div className="text-blue-400">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      </div>
      <div className="flex-grow">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            <div className="h-4 bg-slate-700 rounded w-full"></div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};