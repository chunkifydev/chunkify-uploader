// src/react/ChunkifyUploaderError.tsx
import React, { forwardRef } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-error': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderErrorProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChunkifyUploaderError = forwardRef<HTMLElement, ChunkifyUploaderErrorProps>((props, ref) => {
  return React.createElement('chunkify-uploader-error', {
    ref,
    className: props.className,
    style: props.style,
  }, props.children);
});