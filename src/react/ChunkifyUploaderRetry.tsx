// src/react/ChunkifyUploaderRetry.tsx
import React, { forwardRef } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-retry': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderRetryProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChunkifyUploaderRetry = forwardRef<HTMLElement, ChunkifyUploaderRetryProps>((props, ref) => {
  return React.createElement('chunkify-uploader-retry', {
    ref,
    className: props.className,
    style: props.style,
  }, props.children);
});