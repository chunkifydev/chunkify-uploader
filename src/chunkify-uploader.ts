export class ChunkifyUploader extends HTMLElement {
    static get observedAttributes() {
        return ['no-drop'];
    }
    private _endpoint: string | (() => Promise<string>);
    private currentFile: File | null = null;

    private uploadArea!: HTMLElement;
    private fileInput!: HTMLInputElement;
    private progressBar!: HTMLSlotElement;
    private progressText!: HTMLSlotElement;
    private errorMessage!: HTMLSlotElement;
    private successMessage!: HTMLSlotElement;
    private fileInfo!: HTMLSlotElement;

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


    attributeChangedCallback() {
        if (this.noDrop && this.uploadArea) {
            // Remove existing drag listeners
            this.uploadArea.removeEventListener('dragover', this.handleDragOver);
            this.uploadArea.removeEventListener('dragleave', this.handleDragLeave);
            this.uploadArea.removeEventListener('drop', this.handleDrop);
        }
    }

    private cacheElements() {
        this.uploadArea = this.shadowRoot!.querySelector('.upload-area')!;
        this.fileInput = this.shadowRoot!.querySelector('input[type="file"]')!;
        this.progressBar = this.shadowRoot!.querySelector('slot[name="progress-bar"]') as HTMLSlotElement;
        this.progressText = this.shadowRoot!.querySelector('slot[name="progress-text"]') as HTMLSlotElement;
        this.errorMessage = this.shadowRoot!.querySelector(
            'slot[name="error-message"]'
        ) as HTMLSlotElement;
        this.successMessage = this.shadowRoot!.querySelector(
            'slot[name="success-message"]'
        ) as HTMLSlotElement;
        this.fileInfo = this.shadowRoot!.querySelector('slot[name="file-info"]') as HTMLSlotElement;
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

    get noDrop(): boolean {
        return this.hasAttribute('no-drop');
    }
    
    set noDrop(value: boolean) {
        this.toggleAttribute('no-drop', Boolean(value));
    }

    private isDisabled(): boolean {
        return this.hasAttribute('uploading') || this.hasAttribute('error') || this.hasAttribute('success');
    }

    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                    gap: var(--gap, 8px);
                }
                
                .upload-area {
                    /* Remove display: contents */
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                    min-height: 100px;  /* Ensure it has some height */
                }
                
                /* Only state management, no styling */
                slot[name="progress-text"],
                slot[name="progress-bar"],
                slot[name="file-info"],
                slot[name="error-message"],
                slot[name="retry-button"],
                slot[name="success-message"] {
                    display: none;
                }
                
                /* State-based visibility */
                :host([uploading]) slot[name="file-info"],
                :host([uploading]) slot[name="progress-text"],
                :host([uploading]) slot[name="progress-bar"] { display: block; }
                
                :host([error]) slot[name="error-message"] { display: block; }
                :host([error]) slot[name="retry-button"] { display: block; }
                :host([success]) slot[name="success-message"] { display: block; }
                
                /* Hide upload UI during states */
                :host([uploading]) slot[name="title"],
                :host([uploading]) slot[name="upload-button"],
                :host([error]) slot[name="title"],
                :host([error]) slot[name="upload-button"],
                :host([error]) slot[name="file-info"],
                :host([error]) slot[name="progress-bar"],
                :host([error]) slot[name="progress-text"],
                :host([success]) slot[name="title"],
                :host([success]) slot[name="upload-button"] {
                    display: none;
                }
            </style>
            
            <input type="file" accept="*/*" style="display: none;">
            
            <div class="upload-area">
                <slot name="title"></slot>
                <slot name="upload-button"></slot>
                <slot name="file-info"></slot>
                <slot name="progress-text"></slot>
                <slot name="progress-bar"></slot>
                <slot name="error-message"></slot>
                <slot name="retry-button"></slot>
                <slot name="success-message"></slot>
            </div>
        `;
    }

    private setupEventListeners() {
        console.log('setupEventListeners called');
        console.log('fileInput exists:', !!this.fileInput);
        const uploadSlot = this.shadowRoot!.querySelector('slot[name="upload-button"]') as HTMLSlotElement;
        const uploadElement = uploadSlot.assignedNodes()[0] as HTMLElement

        if (uploadElement) {
            uploadElement.addEventListener('click', () => {
                console.log('Upload button clicked');
                if (!this.hasAttribute('uploading')) {
                    this.fileInput.click();
                }
            });
        } else {
            console.warn('No upload button provided');
        }

        if (!this.uploadArea || !this.fileInput) {
            console.log('Elements not ready, skipping setupEventListeners');
            return;
        }
    

        this.fileInput.addEventListener('change', (e) => {
            console.log('File input change event fired');
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.handleFile(file);
            }
        });

       if (!this.noDrop) {
            this.uploadArea.addEventListener('dragover', this.handleDragOver);
            this.uploadArea.addEventListener('dragleave', this.handleDragLeave);
            this.uploadArea.addEventListener('drop', this.handleDrop);
       }
    
        const retrySlot = this.shadowRoot!.querySelector('slot[name="retry-button"]') as HTMLSlotElement;
        const retryElement = retrySlot.assignedNodes()[0] as HTMLElement

        if (retryElement) {
            retryElement.addEventListener('click', (e) => {
                e.preventDefault();
                    e.stopPropagation();
                    this.resetState();
                });
        }
    }

    private handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        if (!this.isDisabled()) {
            this.setAttribute('dragover', '');
        }
    };
    
    private handleDragLeave = () => {
        this.removeAttribute('dragover');
    };
    
    private handleDrop = (e: DragEvent) => {
        e.preventDefault();
        this.removeAttribute('dragover');
    
        if (!this.isDisabled()) {
            const file = e.dataTransfer?.files[0];
            if (file) {
                this.handleFile(file);
            }
        }
    };

    private resetState() {
        console.log('resetState called');
        this.removeAttribute('dragover');
        this.removeAttribute('error');
        this.removeAttribute('success');
        this.removeAttribute('uploading');

        // Reset progress bar
        this.style.setProperty('--progress', '0%');
        this.setAttribute('progress', "0");
        this.progressText.assignedNodes()[0]!.textContent = '0%';

        // Clear error message
        this.errorMessage.assignedNodes()[0]!.textContent = '';

        // Reset file input
        this.fileInput.value = '';

        // Clear current file
        this.currentFile = null;
    }

    private async handleFile(file: File) {
        // Check endpoint early
        if (!this._endpoint) {
            this.setError(
                'No endpoint attribute provided. Please set endpoint attribute/property.',
                -1
            );
            return;
        }

        // Check file size
        const maxSize = this.maxFileSize;
        if (maxSize > 0 && file.size > maxSize * 1024 * 1024) {
            this.setError(
                `File size exceeds the maximum allowed of ${maxSize} MB`,
                -2
            );
            return;
        }

        this.currentFile = file;

        // Dispatch file selected event immediately
        this.dispatchEvent(
            new CustomEvent('file-selected', {
                detail: {
                    fileName: file.name,
                    fileSize: file.size,
                },
            })
        );

        try {
            // Get URL fist
            const uploadUrl = await this.getUploadUrl();
            this.showProgress();
            // Upload File
            await this.uploadToUrl(file, uploadUrl);
            this.setSuccess(file);
        } catch (error) {
            const errorMessage =(error as any).message || (error as Error).message;
            const statusCode = (error as any).status;
            this.setError(errorMessage, statusCode);
        }
    }


    private async getUploadUrl(): Promise<string> {
        const endpoint = this._endpoint;
        
        // Get URL (function or direct string)
        const url = typeof endpoint === 'function' ? await endpoint() : endpoint;
        
        // Validate URL
        try {
            new URL(url);
        } catch (urlError) {
            throw new Error(`Invalid upload URL`);
        }
        
        return url;
    }

    private async uploadToUrl(file: File, uploadUrl: string) {
        console.log('uploading to url', uploadUrl);
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
        this.style.setProperty('--progress', percent + '%');
        this.setAttribute('progress', Math.round(percent).toString());

        const progressText = this.progressText.assignedNodes()[0] as HTMLElement;

        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }

        this.dispatchEvent(
            new CustomEvent('upload-progress', {
                detail: { progress: percent },
            })
        );
    }

    private showProgress() {
        this.setAttribute('uploading', '');
    
        if (this.currentFile) {
            const sizeInMB = (this.currentFile.size / (1024 * 1024)).toFixed(2);
            
            // Get user's element from file-info slot
            const fileInfoElement = this.fileInfo.assignedNodes()[0] as HTMLElement;
            
            if (fileInfoElement) {
                fileInfoElement.textContent = `Uploading: ${this.currentFile.name} (${sizeInMB} MB)`;
            }
        }
    }

    private setSuccess(file: File) {
        this.removeAttribute('uploading');

        this.setAttribute('success', '');


        this.dispatchEvent(
            new CustomEvent('upload-success', {
                detail: { fileName: file.name },
            })
        );
    }

    private setError(message: string, statusCode: number = 0) {
        this.setAttribute('error', '');
        this.removeAttribute('uploading');
       
        // Check for internal error and force display (except if no error message slot was set)
        // If the user provided a slot but empty it means they want to display the original message that is passed here as parameters
        if (statusCode < 0) {
            console.log('setting early error message', message);
            this.errorMessage.assignedNodes()[0]!.textContent = message;
        } else {
            // Check if user provided empty error slot
            const errorElement = this.errorMessage.assignedNodes()[0] as HTMLElement;
            if (errorElement && (!errorElement.textContent || errorElement.textContent.trim() === '')) {
                errorElement.textContent = message;
            }
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
