'use client';
import React, { useRef, useEffect, FC, ReactNode, CSSProperties } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

interface ChunkifyUploaderProps {
  endpoint?: string | (() => Promise<string>);
  maxFileSize?: number;
  drop?: boolean;
  
  // Event handlers
  onFileSelected?: (event: CustomEvent) => void;
  onUploadProgress?: (event: CustomEvent) => void;
  onUploadSuccess?: (event: CustomEvent) => void;
  onUploadError?: (event: CustomEvent) => void;
  
  // Children
  children?: ReactNode;
  
  // Standard HTML props
  className?: string;
  style?: CSSProperties;
}

export const ChunkifyUploader: FC<ChunkifyUploaderProps> = (props) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    
    const element = ref.current as any;
    
    // Set properties
    if (props.endpoint !== undefined) element.endpoint = props.endpoint;
    if (props.maxFileSize !== undefined) element.maxFileSize = props.maxFileSize;
    if (props.drop !== undefined) element.drop = props.drop;
  }, [props.endpoint, props.maxFileSize, props.drop]);

  useEffect(() => {
    if (!ref.current) return;
    
    const element = ref.current;
    
    // Add event listeners
    if (props.onFileSelected) {
      element.addEventListener('file-selected', props.onFileSelected as EventListener);
    }
    if (props.onUploadProgress) {
      element.addEventListener('upload-progress', props.onUploadProgress as EventListener);
    }
    if (props.onUploadSuccess) {
      element.addEventListener('upload-success', props.onUploadSuccess as EventListener);
    }
    if (props.onUploadError) {
      element.addEventListener('upload-error', props.onUploadError as EventListener);
    }

    return () => {
      if (props.onFileSelected) {
        element.removeEventListener('file-selected', props.onFileSelected as EventListener);
      }
      if (props.onUploadProgress) {
        element.removeEventListener('upload-progress', props.onUploadProgress as EventListener);
      }
      if (props.onUploadSuccess) {
        element.removeEventListener('upload-success', props.onUploadSuccess as EventListener);
      }
      if (props.onUploadError) {
        element.removeEventListener('upload-error', props.onUploadError as EventListener);
      }
    };
  }, [props.onFileSelected, props.onUploadProgress, props.onUploadSuccess, props.onUploadError]);

  return React.createElement('chunkify-uploader', {
    ref: ref,
    className: props.className,
    style: props.style
  }, props.children);
};