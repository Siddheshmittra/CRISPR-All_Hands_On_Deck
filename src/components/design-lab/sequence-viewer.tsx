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
        case 'overexpression': return 'bg-blue-200 text-blue-800';
        case 'knockout': return 'bg-red-200 text-red-800';
        case 'knockdown': return 'bg-yellow-200 text-yellow-800';
        case 'knockin': return 'bg-purple-200 text-purple-800';
        case 'synthetic': return 'bg-green-200 text-green-800';
        default: return 'bg-gray-200 text-gray-800';
      }
    case 'linker':
      return 'bg-gray-300 text-gray-900';
    case 'hardcoded':
      return 'bg-gray-400 text-white';
    default:
      return 'bg-gray-200 text-gray-800';
  }
};

export const SequenceViewer: React.FC<SequenceViewerProps> = ({ segments }) => {
  return (
    <div className="w-full p-2 border rounded-md bg-background">
      <div className="font-mono text-sm break-all whitespace-pre-wrap">
        {segments.map((segment, index) => (
          <Tippy key={index} content={`${segment.name} (${segment.type}) - ${segment.sequence.length}bp`}>
            <span className={`px-1 rounded ${getSegmentStyle(segment)}`}>
              {segment.sequence}
            </span>
          </Tippy>
        ))}
      </div>
    </div>
  );
};
