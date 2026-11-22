import React, { useEffect, useState } from 'react';

interface BrandLogoProps {
  name: string;
  imageDataUrl?: string;
  logoUrl?: string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ name, imageDataUrl, logoUrl, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const source = imageDataUrl || logoUrl || '';
  useEffect(() => setFailed(false), [source]);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`} aria-label={`${name} logo`}>
      {source && !failed ? (
        <img src={source} alt={`${name} logo`} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[10px] font-extrabold tracking-tight text-[#0756A5]">{initials || '?'}</span>
      )}
    </span>
  );
};
