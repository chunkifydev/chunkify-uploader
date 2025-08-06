import React, { useRef, useEffect, FC, ReactNode, CSSProperties } from 'react';

// Auto-import the web component
import 'chunkify-uploader';

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
  accept?: string;
  noRetry?: boolean;
  noFileInfo?: boolean;
  
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
    if (props.accept !== undefined) element.accept = props.accept;
    if (props.noRetry !== undefined) {
      if (props.noRetry) {
        element.setAttribute('no-retry', '');
      } else {
        element.removeAttribute('no-retry');
      }
    }
    if (props.noFileInfo !== undefined) {
      if (props.noFileInfo) {
        element.setAttribute('no-file-info', '');
      } else {
        element.removeAttribute('no-file-info');
      }
    }
  }, [props.endpoint, props.maxFileSize, props.accept, props.noRetry, props.noFileInfo]);

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