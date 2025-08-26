// src/react/ChunkifyUploaderDrop.tsx
import React, { forwardRef } from 'react';
import 'chunkify-uploader/drop';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader-drop': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderDropProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChunkifyUploaderDrop = forwardRef<HTMLElement, ChunkifyUploaderDropProps>((props, ref) => {
  return React.createElement('chunkify-uploader-drop', {
    ref,
    className: props.className,
    style: props.style,
  }, props.children);
});