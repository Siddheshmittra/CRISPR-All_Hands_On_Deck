import React from 'react';
import { Button } from './button';

const benchlingBlue = '#007AFFFF';

const benchlingLogoSvg = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.28-.14-1.25-.61-2.9-1.39-1.65-.78-3.08-1.55-3-3V8h2v4c0 .55.45 1 1 1h2c1.1 0 2-.9 2-2V9.33c1.14.63 2.11 1.54 2.75 2.67.59-1.12.75-2.67.75-4 0-3.93-2.69-7.22-6.25-7.88.24.59.38 1.25.38 1.95 0 1.95-1.14 3.63-2.78 4.45-.1.05-1.11.53-2.22.53H8V8h2V6h2v2h2v2c0 1.65 1.35 3 3 3h1c.55 0 1-.45 1-1v-.93c1.21.5 2.25 1.3 3 2.39-1.28 2.3-3.6 3.96-6.35 4.39z"/>
</svg>
`;

const benchlingLogoDataUri = `data:image/svg+xml;base64,${btoa(benchlingLogoSvg)}`;

interface BenchlingButtonProps {
  isLinked: boolean;
  isLinking: boolean;
  onClick: () => void;
}

export const BenchlingButton: React.FC<BenchlingButtonProps> = ({ isLinked, isLinking, onClick }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      style={{
        backgroundColor: isLinked ? '#E0E0E0' : benchlingBlue,
        color: isLinked ? '#000000' : 'white',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
      disabled={isLinking || isLinked}
    >
      <img src={benchlingLogoDataUri} alt="Benchling Logo" />
      {isLinking ? 'Linking...' : isLinked ? 'Account Linked' : 'Link Benchling Account'}
    </Button>
  );
}; 