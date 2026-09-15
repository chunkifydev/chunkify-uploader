'use client';
import React, { useRef, useEffect, FC, ReactNode, CSSProperties } from 'react';

import type { ChunkifyUploader as UploaderElement, UploadProvider, UploadSuccessDetail, UploadErrorDetail } from '../chunkify-uploader';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chunkify-uploader': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}

export interface ChunkifyUploaderProps {
  upload?: UploadProvider;
  maxFileSize?: number;
  drop?: boolean;
  
  // Event handlers
  onFileSelected?: (event: CustomEvent) => void;
  onUploadProgress?: (event: CustomEvent) => void;
  onUploadSuccess?: (event: CustomEvent<UploadSuccessDetail>) => void;
  onUploadError?: (event: CustomEvent<UploadErrorDetail>) => void;
  
  // Children
  children?: ReactNode;
  
  // Standard HTML props
  className?: string;
  style?: CSSProperties;
}

export const ChunkifyUploader: FC<ChunkifyUploaderProps> = (props) => {
  const ref = useRef<UploaderElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    
    const element = ref.current;
    
    // Set properties
    element.upload = props.upload;
    element.maxFileSize = props.maxFileSize ?? 0;
    element.drop = props.drop ?? false;
  }, [props.upload, props.maxFileSize, props.drop]);

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