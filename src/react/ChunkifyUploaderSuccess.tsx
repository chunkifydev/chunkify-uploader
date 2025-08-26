// src/react/ChunkifyUploaderSuccess.tsx
import React, { forwardRef } from 'react';
import 'chunkify-uploader/success';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-success': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderSuccessProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChunkifyUploaderSuccess = forwardRef<HTMLElement, ChunkifyUploaderSuccessProps>((props, ref) => {
  return React.createElement('chunkify-uploader-success', {
    ref,
    className: props.className,
    style: props.style,
  }, props.children);
});