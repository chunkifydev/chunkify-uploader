// src/react/ChunkifyUploaderFileSelect.tsx
import React, { forwardRef } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-file-select': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderFileSelectProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChunkifyUploaderFileSelect = forwardRef<HTMLElement, ChunkifyUploaderFileSelectProps>((props, ref) => {
  return React.createElement('chunkify-uploader-file-select', {
    ref,
    className: props.className,
    style: props.style,
  }, props.children);
});