import { useState } from 'react';

export default function AppIcon({ src, name, size = 32, className = '' }) {
  const px = `${size}px`;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const [failed, setFailed] = useState(false);

  const showLetter = !src || failed;

  if (showLetter) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-[7px] bg-[#E5E5EA] font-medium text-[#8E8E93] dark:bg-white/10 dark:text-white/50 ${className}`}
        style={{ width: px, height: px, fontSize: Math.max(11, size * 0.42) }}
        title={name}
        aria-hidden
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-[7px] object-contain bg-[#E5E5EA]/50 dark:bg-white/10 ${className}`}
      style={{ width: px, height: px }}
      onError={() => setFailed(true)}
      title={name}
    />
  );
}
