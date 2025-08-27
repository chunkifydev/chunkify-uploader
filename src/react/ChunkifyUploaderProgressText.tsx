// src/react/ChunkifyUploaderProgressText.tsx
import React, { forwardRef } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-progress-text': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderProgressTextProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ChunkifyUploaderProgressText = forwardRef<HTMLElement, ChunkifyUploaderProgressTextProps>((props, ref) => {
  return React.createElement('chunkify-uploader-progress-text', {
    ref,
    className: props.className,
    style: props.style,
  });
});