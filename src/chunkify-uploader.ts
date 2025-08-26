export class ChunkifyUploader extends HTMLElement {
    private dropListenersSetup: boolean = false;
    static get observedAttributes() {
        return ['drop'];
    }
    private _endpoint: string | (() => Promise<string>);
    private fileInput!: HTMLInputElement;

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
        if (this.drop && !this.dropListenersSetup)  {
            this.setupDropListeners();
            this.dropListenersSetup = true;
        }
    }

    private cacheElements() {
        this.fileInput = this.shadowRoot!.querySelector('input[type="file"]')!;
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
    private isDisabled(): boolean {
        return this.hasAttribute('uploading') || this.hasAttribute('error') || this.hasAttribute('success');
    }

    get drop(): boolean {
        return this.hasAttribute('drop');
    }
    
    set drop(value: boolean) {
        this.toggleAttribute('drop', Boolean(value));
    }

    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                }
                    
                /* Hide sub-components during uploading */
                :host([uploading]) {
                   --upload-button-display: none;
                   --progress-text-display: block;
                   --progress-bar-display: block;
                   --heading-display: none;
                }

                :host([error]) {
                    --upload-button-display: none;
                    --progress-text-display: none;
                    --progress-bar-display: none;
                    --error-message-display: block;
                    --heading-display: none;
                    --retry-display: block;
                }

                :host([success]) {
                    --upload-button-display: none;
                    --progress-text-display: none;
                    --progress-bar-display: none;
                    --success-message-display: block;
                    --heading-display: none;
                }

            </style>
            
            <input type="file" accept="*/*" style="display: none;">
            
            <slot></slot>
        `;
    }

    private setupEventListeners() {
        console.log('setupEventListeners called');
        console.log('fileInput exists:', !!this.fileInput);

        this.addEventListener('file-select-clicked', () => {
            console.log('Sub-component upload button clicked');
            console.log('fileInput when clicked:', this.fileInput);
            if (!this.hasAttribute('uploading')) {
                this.fileInput.click();
            }
        });

        if (!this.fileInput) {
            console.log('FileInput not ready, skipping setupEventListeners');
            return;
        }
    

        this.fileInput.addEventListener('change', (e) => {
            console.log('File input change event fired');
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.handleFile(file);
            }
        });

        if (this.hasAttribute('drop') && !this.dropListenersSetup) {
            this.setupDropListeners();
            this.dropListenersSetup = true;
        }

        this.addEventListener('reset', () => {
            this.resetState();
        });
    }

    private setupDropListeners() {
        this.addEventListener('dragover', (e) => {
            if (this.isDisabled()) return;
            e.preventDefault();
            this.setAttribute('dragover', ''); // ✅ Just set the attribute
        });
    
        this.addEventListener('dragleave', (e) => {
            if (this.isDisabled()) return;
            if (!this.contains(e.relatedTarget as Node)) {
                this.removeAttribute('dragover'); // ✅ Just remove the attribute
            }
        });
    
        this.addEventListener('drop', (e) => {
            if (this.isDisabled()) return;
            e.preventDefault();
            this.removeAttribute('dragover');
            
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }


    private resetState() {
        console.log('resetState called');
        this.removeAttribute('dragover');
        this.removeAttribute('error');
        this.removeAttribute('success');
        this.removeAttribute('uploading');

        // Reset sub-components
        const progressText = this.querySelector('chunkify-uploader-progress-text');
        const progressBar = this.querySelector('chunkify-uploader-progress-bar');
 
        progressText?.setAttribute('value', '0');
        progressBar?.setAttribute('value', '0');
        
    
        // Clear error message
   
        // Reset file input
        this.fileInput.value = '';

        this.dispatchEvent(new CustomEvent('upload-reset', {
            bubbles: true
        }));
    }

    private async handleFile(file: File) {
        // Check endpoint early
        if (!this._endpoint) {
            console.log('No endpoint attribute provided. Please set endpoint attribute/property.');
            this.setError(
                'No endpoint attribute provided. Please set endpoint attribute/property.',
                -1
            );
            return;
        }

        // Check file size
        const maxSize = this.maxFileSize;
        console.log('maxSize', maxSize);
        console.log('file.size', file.size);
        if (maxSize > 0 && file.size > maxSize * 1024 * 1024) {
            console.log('File size exceeds the maximum allowed of ${maxSize} MB');
            this.setError(
                `File size exceeds the maximum allowed of ${maxSize} MB`,
                -2
            );
            return;
        }
        
        // Dispatch file selected event immediately
        this.dispatchEvent(
            new CustomEvent('file-selected', {
                detail: {
                    file: file,
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
            console.log('Error during upload:', error);
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
        this.setAttribute('progress', Math.round(percent).toString());

        // Update sub-components directly
        const progressText = this.querySelector('chunkify-uploader-progress-text');
        const progressBar = this.querySelector('chunkify-uploader-progress-bar');

        progressText?.setAttribute('value', Math.round(percent).toString());
        progressBar?.setAttribute('value', Math.round(percent).toString());

        this.dispatchEvent(
            new CustomEvent('upload-progress', {
                detail: { progress: percent },
            })
        );
    }

    private showProgress() {
        this.setAttribute('uploading', '');
    
        /* if (this.currentFile) {
            const sizeInMB = (this.currentFile.size / (1024 * 1024)).toFixed(2);
            
            // Get user's element from file-info slot
            const fileInfoElement = this.fileInfo.assignedNodes()[0] as HTMLElement;
            
            if (fileInfoElement) {
                fileInfoElement.textContent = `Uploading: ${this.currentFile.name} (${sizeInMB} MB)`;
            }
        } */
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
            console.log('Setup error: ', message);
            //  Find and update error message component
            const errorMessage = this.querySelector('chunkify-error-message');
            if (errorMessage) {
                (errorMessage as any).setMessage(message);
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
