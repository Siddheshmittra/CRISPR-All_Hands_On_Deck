import React from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { AnnotatedSegment } from '@/lib/types';

interface SequenceViewerProps {
  segments: AnnotatedSegment[];
}

const getSegmentStyle = (segment: AnnotatedSegment) => {
  switch (segment.type) {
    case 'module':
      switch (segment.action) {
        case 'overexpression': return 'bg-lime-300 dark:bg-lime-800 text-lime-900 dark:text-lime-100';
        case 'knockout': return 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200';
        case 'knockdown': return 'bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
        case 'knockin': return 'bg-knockin text-knockin-foreground';
        case 'synthetic': return 'bg-knockin text-knockin-foreground';
        default: return 'bg-muted text-muted-foreground';
      }
    case 'linker':
      return 'bg-muted text-foreground';
    case 'hardcoded':
      return 'bg-muted-foreground/20 text-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const SequenceViewer: React.FC<SequenceViewerProps> = ({ segments }) => {
  return (
    <div className="w-full p-2 border rounded-md bg-background">
      <div className="font-mono text-sm break-all whitespace-pre-wrap">
        {segments.map((segment, index) => (
          <Tippy key={index} content={`${segment.name} - ${segment.sequence.length}bp`}>
            <span className={`px-1 rounded ${getSegmentStyle(segment)}`}>
              {segment.sequence}
            </span>
          </Tippy>
        ))}
      </div>
    </div>
  );
};
