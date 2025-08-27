// src/react/ChunkifyUploaderHeading.tsx
import React, { forwardRef } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-heading': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderHeadingProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChunkifyUploaderHeading = forwardRef<HTMLElement, ChunkifyUploaderHeadingProps>((props, ref) => {
  return React.createElement('chunkify-uploader-heading', {
    ref,
    className: props.className,
    style: props.style,
  }, props.children);
});