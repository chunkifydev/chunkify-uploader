export class ChunkifyUploader extends HTMLElement {
    private _endpoint: string | (() => Promise<string>);
    private currentFile: File | null = null;

    private uploadArea!: HTMLElement;
    private titleText!: HTMLSlotElement;
    private fileInput!: HTMLInputElement;
    private progress!: HTMLElement;
    private progressBar!: HTMLElement;
    private progressText!: HTMLElement;
    private errorMessage!: HTMLSlotElement;
    private successMessage!: HTMLSlotElement;
    private fileInfo!: HTMLElement;
    private uploadButton!: HTMLSlotElement;
    private retryButton!: HTMLSlotElement;
    private retryContainer!: HTMLElement;
    private errorContainer!: HTMLElement;
    private successContainer!: HTMLElement;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._endpoint = this.getAttribute('endpoint') || '';
    }

    connectedCallback() {
        this.render();
        this.cacheElements();
        this.setupEventListeners();
    }
    private cacheElements() {
        this.uploadArea = this.shadowRoot!.querySelector('.upload-area')!;
        this.titleText = this.shadowRoot!.querySelector('slot[name="title"]')!;
        this.fileInput = this.shadowRoot!.querySelector('input[type="file"]')!;
        this.progress = this.shadowRoot!.querySelector('.progress')!;
        this.progressBar = this.shadowRoot!.querySelector('.progress-bar')!;
        this.progressText = this.shadowRoot!.querySelector('.progress-text')!;
        this.errorMessage = this.shadowRoot!.querySelector(
            'slot[name="error-message"]'
        ) as HTMLSlotElement;
        this.successMessage = this.shadowRoot!.querySelector(
            'slot[name="success-message"]'
        ) as HTMLSlotElement;
        this.fileInfo = this.shadowRoot!.querySelector('.file-info')!;
        this.uploadButton = this.shadowRoot!.querySelector('slot[name="upload-button"]')!;
        this.retryButton = this.shadowRoot!.querySelector('slot[name="retry-button"]')!;
        this.retryContainer =
            this.shadowRoot!.querySelector('.retry-container')!;
        this.errorContainer =
            this.shadowRoot!.querySelector('.error-container')!;
        this.successContainer =
            this.shadowRoot!.querySelector('.success-container')!;
    }

    get endpoint(): string | (() => Promise<string>) {
        return this.getAttribute('endpoint') ?? this._endpoint;
    }

    set endpoint(value: string | (() => Promise<string>)) {
        if (value === this._endpoint) return;
        if (typeof value === 'string') {
            this.setAttribute('endpoint', value);
        } else if (value == undefined) {
            this.removeAttribute('endpoint');
        }
        this._endpoint = value;
    }

    get maxFileSize(): number {
        const value = this.getAttribute('max-file-size');
        return value ? parseInt(value, 10) : 0; // 0 means no limit
    }
    
    set maxFileSize(value: number) {
        if (value > 0) {
            this.setAttribute('max-file-size', value.toString());
        } else {
            this.removeAttribute('max-file-size');
        }
    }

    private render() {
        this.shadowRoot!.innerHTML = `
          <style>
            :host {
                display: block;
                width: 100%;
                height: 100%;
                border: 2px dashed #ccc;
                padding: 20px;
                text-align: center;
                border-radius: 8px;
                background: #fafafa;
                color: inherit;
                font-family: inherit;
                box-sizing: border-box;
                }
      
            :host([dragover]) {
                border-color:  #007bff;
                background:  #e3f2fd;
            }
      
            :host([error]) {
                border-color: #dc3545;
                background: #fff5f5;
            }
      
            :host([success]) {
                border-color: #28a745;
                background: #f8fff9;
            }

            /* Default state  */
            .upload-button, slot[name="upload-button"] {
                display: inline-block;
            }

            .title, slot[name="title"] {
                display: block;
            }

            
            /* Hide other elements by default */
            .progress, .file-info, .error-container, .success-container, .retry-container {
                display: none;
            }

            /* Error state */
            :host([error]) .upload-button,
            :host([error]) slot[name="upload-button"],
            :host([error]) .title,
            :host([error]) slot[name="title"],
            :host([error]) .file-info {
                display: none;
            }

            :host([error]) .error-container,
            
            /* Show retry container only if NOT no-retry */
            :host([error]:not([no-retry])) .retry-container {
                display: block;
            }

            /* Success state */
            :host([success]) .upload-button,
            :host([success]) slot[name="upload-button"],
            :host([success]) .title,
            :host([success]) slot[name="title"] {
                display: none;
            }

            :host([success]) .success-container {
                display: block;
            }

            /* Uploading state */
            :host([uploading]) .upload-button,
            :host([uploading]) slot[name="upload-button"],
            :host([uploading]) .title,
            :host([uploading]) slot[name="title"] {
                display: none;
            }

            :host([uploading]) .progress,
            :host([uploading]) .file-info {
                display: block;
            }
            
            .upload-button {
              background: #16a249;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              margin: 10px auto;
              transition: background-color 0.3s ease;
            }

            slot[name="upload-button"] {
                margin: 10px auto;
                }
            
            .upload-button:hover {
              background: #01913f;
            }
            
            .upload-button:disabled {
              background: #6c757d;
              cursor: not-allowed;
            }
            
            .progress {
              width: 100%;
              margin-top: 15px;
            }
            
            .progress-background {
              width: 80%;
              height: 6px;
              background-color: #e9ecef;
              border-radius: 3px;
              margin: 0 auto;
            }
            
            .progress-bar {
              height: 100%;
              background-color: var(--progress-bar-color, #007bff);
              border-radius: var(--progress-bar-radius, 3px);
              transition: width 0.3s;
              width: 0%;
            }

            .progress-text {
              text-align: center;
              margin-bottom: 8px;
              font-size: var(--progress-text-font-size, 14px);
              color: var(--progress-text-color, #666);
              font-weight: var(--progress-text-font-weight, 500);
            }
        
            .retry-button {
              background: #dc3545;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              margin: 10px auto;
              font-size: 14px;
            }
            
            .retry-button:hover {
              background: #c82333;
            }

            slot[name="retry-button"] {
                margin: 10px auto;
            }

            slot[name="title"] {
                font-size: var(--title-font-size, 16px);
                font-weight: var(--title-font-weight,semibold);
        
            }
            
            slot[name="success-message"] {
                color: var(--success-message-color, #28a745);
                font-weight: var(--success-message-font-weight, bold);
                font-size: var(--success-message-font-size, inherit);
                }

            slot[name="error-message"] {
                color: var(--error-message-color, #dc3545);
                font-weight: var(--error-message-font-weight, bold);
                font-size: var(--error-message-font-size, inherit);
                }

            .error-container {
                margin-top: var(--error-margin-top, 10px);
                text-align:center;
            }

            .success-container {
                margin-top: var(--success-margin-top, 10px);
                text-align:center;
            }
            
            .file-info {
              margin-top: 10px;
              font-size: 14px;
              color: #666;
            }
          </style>
          
          <div class="upload-area">
            <input type="file" accept="video/*" style="display: none;">
            <slot name="title">
                <p class="title">Drop video file here or click the button below</p>
            </slot>
            <!-- Slot for custom upload button -->
            <slot name="upload-button">
                <button class="upload-button">Upload Video</button>
            </slot>
            <div class="file-info"></div>
            <div class="progress">
              <div class="progress-text">0%</div>
              <div class="progress-background">
                <div class="progress-bar"></div>
                </div>
            </div>
            <!-- Slot for custom retry button -->
            <div class="retry-container">
                <slot name="retry-button">
                    <button class="retry-button">Try Again</button>
                </slot>
            </div>
            <div class="error-container">
                <slot name="error-message">
                </slot>
            </div>
            <div class="success-container">
                <slot name="success-message">
                </slot>
            </div>
          </div>
        `;
    }

    private setupEventListeners() {
        const uploadSlot = this.shadowRoot!.querySelector('slot[name="upload-button"]') as HTMLSlotElement;
        const uploadElement = uploadSlot.assignedNodes()[0] as HTMLElement || this.shadowRoot!.querySelector('.upload-button')!;

        uploadElement.addEventListener('click', () => {
            if (!this.isUploading()) {
                this.fileInput.click();
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.handleFile(file);
            }
        });

        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.isUploading()) {
                this.setAttribute('dragover', '');
            }
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.removeAttribute('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.removeAttribute('dragover');

            if (!this.isUploading()) {
                const file = (e as DragEvent).dataTransfer?.files[0];
                if (file) {
                    this.handleFile(file);
                }
            }
        });

        const retrySlot = this.shadowRoot!.querySelector('slot[name="retry-button"]') as HTMLSlotElement;
        const retryElement = retrySlot.assignedNodes()[0] as HTMLElement || this.shadowRoot!.querySelector('.retry-button')!;

        retryElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.resetState();
        });
    }

    private isUploading(): boolean {
        return this.progress.style.display === 'block';
    }

    private resetState() {
        console.log('resetState called');

        this.removeAttribute('dragover');
        this.removeAttribute('error');
        this.removeAttribute('success');
        this.removeAttribute('uploading');

        // Reset progress bar
        this.progressBar.style.width = '0%';
        this.progressText.textContent = '0%';

        // Clear error message
        this.errorMessage.textContent = '';

        // Reset file input
        this.fileInput.value = '';

        // Clear current file
        this.currentFile = null;
    }

    private async handleFile(file: File) {
        // Check endpoint early
        if (!this._endpoint) {
            this.showError(
                'No endpoint attribute provided. Please set endpoint attribute or assign a function to the endpoint property.',
                -1
            );
            return;
        }

        // Check file size
        const maxSize = this.maxFileSize;
        if (maxSize > 0 && file.size > maxSize * 1024 * 1024) {
            this.showError(
                `File size exceeds the maximum allowed size of ${maxSize} MB`,
                -2
            );
            return;
        }

        this.currentFile = file;

        try {
            this.showProgress();
            await this.uploadFile(file);
            this.showSuccess(file);
        } catch (error) {
            const errorMessage =(error as any).message || (error as Error).message;
            const statusCode = (error as any).status;
            this.showError(errorMessage, statusCode);
        }
    }

    private showFileInfo(file: File) {
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        this.fileInfo.textContent = `Selected: ${file.name} (${sizeInMB} MB)`;
        this.fileInfo.style.display = 'block';
    }

    private async uploadFile(file: File) {
        const uploadUrl = await this.getUploadUrl();
        // 1. Upload file using your code
        await this.uploadToUrl(file, uploadUrl);

        // 2. Notify completion
        this.dispatchEvent(
            new CustomEvent('upload-complete', {
                detail: {
                    fileName: file.name,
                    fileSize: file.size,
                },
            })
        );
    }

    private async getUploadUrl(): Promise<string> {
        const endpoint = this._endpoint;
    
        // Check if it's a function and execute it
        if (typeof endpoint === 'function') {
            try {
                return await endpoint();
            } catch (error) {
                // If the error has a status, pass it through
                if (error && typeof error === 'object' && 'status' in error) {
                    console.log('error with status', error);
                    throw error;
                }
                // Otherwise, add status 0 for network errors
                throw { message: (error as Error).message, status: 0 };
            }
        } else {
            // Use as direct URL
            return endpoint;
        }
    }

    private async uploadToUrl(file: File, uploadUrl: string) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    this.updateProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(xhr.response);
                } else {
                    reject({
                        message: `Upload failed with status: ${xhr.status}`,
                        status: xhr.status,
                    });
                }
            };

            xhr.onerror = () =>
                reject({
                    message: 'Network error during upload',
                    status: xhr.status,
                });
            xhr.ontimeout = () =>
                reject({ message: 'Upload timed out', status: xhr.status });

            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.timeout = 30000; // 30 second timeout
            xhr.send(file);
        });
    }

    private updateProgress(percent: number) {
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${Math.round(percent)}%`;

        this.dispatchEvent(
            new CustomEvent('upload-progress', {
                detail: { progress: percent },
            })
        );
    }

    private showProgress() {
        this.removeAttribute('error');
        this.removeAttribute('success');
        this.setAttribute('uploading', '');

        if (this.currentFile) {
            const sizeInMB = (this.currentFile.size / (1024 * 1024)).toFixed(2);
            this.fileInfo.textContent = `Uploading: ${this.currentFile.name} (${sizeInMB} MB)`;
        }
    }

    private showSuccess(file: File) {
        this.removeAttribute('error');
        this.removeAttribute('uploading');
        this.setAttribute('success', '');

        // Check if user provided custom content
        const hasCustomContent =
            this.successMessage &&
            this.successMessage.assignedNodes().length > 0;

        if (!hasCustomContent) {
            this.successMessage.textContent = `✅ ${file.name} uploaded successfully!`;
        }

        this.dispatchEvent(
            new CustomEvent('upload-success', {
                detail: { fileName: file.name },
            })
        );
    }

    private showError(message: string, statusCode?: number) {
        this.removeAttribute('success');
        this.removeAttribute('uploading');
        this.setAttribute('error', '');

        console.log('Error attribute set:', this.hasAttribute('error'));
        console.log('Error container display:', this.errorContainer.style.display);
        console.log('Error container computed style:', window.getComputedStyle(this.errorContainer).display);


        console.log('statusCode', statusCode);
        // If statusCode is -1, it means the endpoint is not set so return early with the message.
        if (statusCode === -1) {
            this.errorContainer.innerHTML = message;
            return;
        }
        // Check if user provided custom content
        const hasCustomContent =
            this.errorMessage && this.errorMessage.assignedNodes().length > 0;

        if (!hasCustomContent) {
            this.errorMessage.textContent = message;
        }

        this.dispatchEvent(
            new CustomEvent('upload-error', {
                detail: {
                    error: message,
                    status: statusCode,
                },
            })
        );
    }
}

customElements.define('chunkify-uploader', ChunkifyUploader);
