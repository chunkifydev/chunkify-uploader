export class ChunkifyUploader extends HTMLElement {
    private apiEndpoint: string;
    private currentFile: File | null = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.apiEndpoint = this.getAttribute('api-endpoint') || '/api/upload';
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    // Helper method to get default or slot buttons
    // Helper method to get default or slot buttons
    private getButton(buttonType: 'upload' | 'retry'): HTMLElement {
        const slotName = buttonType === 'upload' ? 'upload-button' : 'retry-button';
        const className = buttonType === 'upload' ? '.upload-button' : '.retry-button';

        // Check if slot has content
        const slot = this.shadowRoot!.querySelector(`slot[name="${slotName}"]`) as HTMLSlotElement;
        const hasSlottedContent = slot && slot.assignedNodes().length > 0;
        
        if (hasSlottedContent) {
            // Return the slotted element
            return slot.assignedNodes()[0] as HTMLElement;
        } else {
            // Return the default button
            return this.shadowRoot!.querySelector(className) as HTMLElement;
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
            
            .upload-button {
              background: #16a249;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              margin: 10px auto;
              display: inline-block;
              transition: background-color 0.3s ease;
            }

            slot[name="upload-button"] {
                margin: 10px auto;
                display: inline-block;
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
              height: 6px;
              background-color: #e9ecef;
              border-radius: 3px;
              margin-top: 15px;
            }
            
            .progress-bar {
              height: 100%;
              background-color: var(--progress-bar-color, #007bff);
              border-radius: var(--progress-bar-radius, 3px);
              transition: width 0.3s;
              width: 0%;
            }
            
            .retry-button {
              background: #dc3545;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              margin: 10px auto;
              display: inline-block;
              font-size: 14px;
            }
            
            .retry-button:hover {
              background: #c82333;
            }

            slot[name="retry-button"] {
                margin: 10px auto;
                display: inline-block;
            }
            
            .success-message {
                color: var(--success-message-color, #28a745);
                margin-top: 10px;
                font-weight: var(--success-message-font-weight, bold);
                font-size: var(--success-message-font-size, inherit);
                text-align: center;
                }

            .error-message {
                color: var(--error-message-color, #dc3545);
                margin-top: 10px;
                font-weight: var(--error-message-font-weight, bold);
                font-size: var(--error-message-font-size, inherit);
                text-align: center;
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
                <p>Drop video file here or click the button below</p>
            </slot>
            <!-- Slot for custom upload button -->
            <slot name="upload-button">
                <button class="upload-button">Upload Video</button>
            </slot>
            <div class="file-info" style="display: none;"></div>
            <div class="progress" style="display: none;">
              <div class="progress-bar"></div>
            </div>
            <!-- Slot for custom retry button -->
            <slot name="retry-button">
                <button class="retry-button" style="display: none;">Try Again</button>
            </slot>
            <div class="error-message" style="display: none;"></div>
            <div class="success-message" style="display: none;"></div>
          </div>
        `;
    }

    private setupEventListeners() {
        const uploadArea = this.shadowRoot!.querySelector('.upload-area')!;
        const fileInput = this.shadowRoot!.querySelector('input[type="file"]')!;
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');

        uploadButton.addEventListener('click', () => {
            if (!this.isUploading()) {
                (fileInput as HTMLInputElement).click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.handleFile(file);
            }
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.isUploading()) {
                this.setAttribute('dragover', '');
            }
        });

        uploadArea.addEventListener('dragleave', () => {
            this.removeAttribute('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.removeAttribute('dragover');

            if (!this.isUploading()) {
                const file = (e as DragEvent).dataTransfer?.files[0];
                if (file) {
                    this.handleFile(file);
                }
            }
        });

        retryButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.resetState();
        });
    }

    private isUploading(): boolean {
        const progress = this.shadowRoot!.querySelector('.progress')!;
        return (progress as HTMLElement).style.display === 'block';
    }

    private resetState() {
        console.log('resetState called');
        const uploadArea = this.shadowRoot!.querySelector('.upload-area')!;
        const progress = this.shadowRoot!.querySelector('.progress')!;
        const error = this.shadowRoot!.querySelector('.error-message')!;
        const success = this.shadowRoot!.querySelector('.success-message')!;
        const fileInfo = this.shadowRoot!.querySelector('.file-info')!;

        // Get buttons from slots or fallback to default
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');

        this.removeAttribute('dragover');
        this.removeAttribute('error');
        this.removeAttribute('success');

        (progress as HTMLElement).style.display = 'none';
        (error as HTMLElement).style.display = 'none';
        (success as HTMLElement).style.display = 'none';
        (fileInfo as HTMLElement).style.display = 'none';
        (uploadButton as HTMLElement).style.display = 'block';
        (retryButton as HTMLElement).style.display = 'none';

        (uploadArea as HTMLElement).style.display = 'block';

        // Reset progress bar
        const progressBar = this.shadowRoot!.querySelector('.progress-bar')!;
        (progressBar as HTMLElement).style.width = '0%';

        // Clear error message
        const errorMessage = this.shadowRoot!.querySelector('.error-message')!;
        errorMessage.textContent = '';

        // Reset file input
        const fileInput = this.shadowRoot!.querySelector('input[type="file"]')!;
        (fileInput as HTMLInputElement).value = '';

        // Clear current file
        this.currentFile = null;
    }

    private async handleFile(file: File) {
        this.currentFile = file;
        this.showFileInfo(file);

        try {
            this.showProgress();
            await this.uploadFile(file);
            this.showSuccess(file);
        } catch (error) {
            this.showError((error as Error).message);
        }
    }

    private showFileInfo(file: File) {
        const fileInfo = this.shadowRoot!.querySelector('.file-info')!;
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        fileInfo.textContent = `Selected: ${file.name} (${sizeInMB} MB)`;
        (fileInfo as HTMLElement).style.display = 'block';
    }

    private async uploadFile(file: File) {
        // 1. Get upload URL from user's API
        const uploadData = await this.getUploadUrl();

        // 2. Upload file using your code
        await this.uploadToUrl(file, uploadData.upload_url);

        // 3. Notify completion
        this.dispatchEvent(
            new CustomEvent('upload-complete', {
                detail: {
                    fileName: file.name,
                    fileSize: file.size,
                },
            })
        );
    }

    private async getUploadUrl() {
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Error: server responded with ${response.status}`
            );
        }

        return response.json();
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
                    reject(
                        new Error(`Upload failed with status: ${xhr.status}`)
                    );
                }
            };

            xhr.onerror = () =>
                reject(new Error('Network error during upload'));
            xhr.ontimeout = () => reject(new Error('Upload timed out'));

            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.timeout = 30000; // 30 second timeout
            xhr.send(file);
        });
    }

    private updateProgress(percent: number) {
        const progressBar = this.shadowRoot!.querySelector('.progress-bar')!;
        if (progressBar) {
            (progressBar as HTMLElement).style.width = `${percent}%`;
        }

        this.dispatchEvent(
            new CustomEvent('upload-progress', {
                detail: { progress: percent },
            })
        );
    }

    private showProgress() {
        const uploadArea = this.shadowRoot!.querySelector('.upload-area')!;
        const progress = this.shadowRoot!.querySelector('.progress')!;
        const error = this.shadowRoot!.querySelector('.error-message')!;
        const success = this.shadowRoot!.querySelector('.success-message')!;
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');
        const fileInfo = this.shadowRoot!.querySelector('.file-info')!;

        this.removeAttribute('error');
        this.removeAttribute('success');

        (progress as HTMLElement).style.display = 'block';
        (fileInfo as HTMLElement).style.display = 'block';

        (error as HTMLElement).style.display = 'none';
        (success as HTMLElement).style.display = 'none';
        (uploadButton as HTMLElement).style.display = 'none';
        (retryButton as HTMLElement).style.display = 'none';

        if (this.currentFile) {
            fileInfo.textContent = `Uploading: ${this.currentFile.name}`;
          }
    }

    private showSuccess(file: File) {
        const uploadArea = this.shadowRoot!.querySelector('.upload-area')!;
        const progress = this.shadowRoot!.querySelector('.progress')!;
        const success = this.shadowRoot!.querySelector('.success-message')!;
        const fileInfo = this.shadowRoot!.querySelector('.file-info')!;
        const uploadButton = this.getButton('upload');

        this.setAttribute('success', '');
        (progress as HTMLElement).style.display = 'none';
        (success as HTMLElement).style.display = 'block';

        (uploadButton as HTMLElement).style.display = 'none';
        (fileInfo as HTMLElement).style.display = 'none';
        success.textContent = `✅ ${file.name} uploaded successfully!`;

        this.dispatchEvent(
            new CustomEvent('upload-success', {
                detail: { fileName: file.name },
            })
        );
    }

    private showError(message: string) {
        const uploadArea = this.shadowRoot!.querySelector('.upload-area')!;
        const progress = this.shadowRoot!.querySelector('.progress')!;
        const error = this.shadowRoot!.querySelector('.error-message')!;
        const fileInfo = this.shadowRoot!.querySelector('.file-info')!;
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');

        this.setAttribute('error', '');
        (progress as HTMLElement).style.display = 'none';
        (fileInfo as HTMLElement).style.display = 'none';
        (error as HTMLElement).style.display = 'block';
        (uploadButton as HTMLElement).style.display = 'none';
        (retryButton as HTMLElement).style.display = 'block';
        error.textContent = message;

        this.dispatchEvent(
            new CustomEvent('upload-error', {
                detail: { error: message },
            })
        );
    }
}

customElements.define('chunkify-uploader', ChunkifyUploader);
