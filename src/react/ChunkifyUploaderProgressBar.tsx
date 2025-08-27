// src/react/ChunkifyUploaderProgressBar.tsx
import React, { forwardRef } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-progress-bar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderProgressBarProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ChunkifyUploaderProgressBar = forwardRef<HTMLElement, ChunkifyUploaderProgressBarProps>((props, ref) => {
  return React.createElement('chunkify-uploader-progress-bar', {
    ref,
    className: props.className,
    style: props.style,
  });
});