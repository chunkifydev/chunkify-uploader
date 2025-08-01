var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class ChunkifyUploader extends HTMLElement {
    constructor() {
        super();
        this.currentFile = null;
        this.attachShadow({ mode: 'open' });
        this.apiEndpoint = this.getAttribute('api-endpoint') || '/api/upload';
    }
    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }
    // Helper method to get default or slot buttons
    // Helper method to get default or slot buttons
    getButton(buttonType) {
        const slotName = buttonType === 'upload' ? 'upload-button' : 'retry-button';
        const className = buttonType === 'upload' ? '.upload-button' : '.retry-button';
        // Check if slot has content
        const slot = this.shadowRoot.querySelector(`slot[name="${slotName}"]`);
        const hasSlottedContent = slot && slot.assignedNodes().length > 0;
        if (hasSlottedContent) {
            // Return the slotted element
            return slot.assignedNodes()[0];
        }
        else {
            // Return the default button
            return this.shadowRoot.querySelector(className);
        }
    }
    render() {
        this.shadowRoot.innerHTML = `
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
    setupEventListeners() {
        const uploadArea = this.shadowRoot.querySelector('.upload-area');
        const fileInput = this.shadowRoot.querySelector('input[type="file"]');
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');
        uploadButton.addEventListener('click', () => {
            if (!this.isUploading()) {
                fileInput.click();
            }
        });
        fileInput.addEventListener('change', (e) => {
            var _a;
            const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
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
            var _a;
            e.preventDefault();
            this.removeAttribute('dragover');
            if (!this.isUploading()) {
                const file = (_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.files[0];
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
    isUploading() {
        const progress = this.shadowRoot.querySelector('.progress');
        return progress.style.display === 'block';
    }
    resetState() {
        console.log('resetState called');
        const uploadArea = this.shadowRoot.querySelector('.upload-area');
        const progress = this.shadowRoot.querySelector('.progress');
        const error = this.shadowRoot.querySelector('.error-message');
        const success = this.shadowRoot.querySelector('.success-message');
        const fileInfo = this.shadowRoot.querySelector('.file-info');
        // Get buttons from slots or fallback to default
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');
        this.removeAttribute('dragover');
        this.removeAttribute('error');
        this.removeAttribute('success');
        progress.style.display = 'none';
        error.style.display = 'none';
        success.style.display = 'none';
        fileInfo.style.display = 'none';
        uploadButton.style.display = 'block';
        retryButton.style.display = 'none';
        uploadArea.style.display = 'block';
        // Reset progress bar
        const progressBar = this.shadowRoot.querySelector('.progress-bar');
        progressBar.style.width = '0%';
        // Clear error message
        const errorMessage = this.shadowRoot.querySelector('.error-message');
        errorMessage.textContent = '';
        // Reset file input
        const fileInput = this.shadowRoot.querySelector('input[type="file"]');
        fileInput.value = '';
        // Clear current file
        this.currentFile = null;
    }
    handleFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentFile = file;
            this.showFileInfo(file);
            try {
                this.showProgress();
                yield this.uploadFile(file);
                this.showSuccess(file);
            }
            catch (error) {
                this.showError(error.message);
            }
        });
    }
    showFileInfo(file) {
        const fileInfo = this.shadowRoot.querySelector('.file-info');
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        fileInfo.textContent = `Selected: ${file.name} (${sizeInMB} MB)`;
        fileInfo.style.display = 'block';
    }
    uploadFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Get upload URL from user's API
            const uploadData = yield this.getUploadUrl();
            // 2. Upload file using your code
            yield this.uploadToUrl(file, uploadData.upload_url);
            // 3. Notify completion
            this.dispatchEvent(new CustomEvent('upload-complete', {
                detail: {
                    fileName: file.name,
                    fileSize: file.size,
                },
            }));
        });
    }
    getUploadUrl() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                const errorText = yield response.text();
                throw new Error(`Error: server responded with ${response.status} - ${errorText}`);
            }
            return response.json();
        });
    }
    uploadToUrl(file, uploadUrl) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    }
                    else {
                        reject(new Error(`Upload failed with status: ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.ontimeout = () => reject(new Error('Upload timed out'));
                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                xhr.timeout = 30000; // 30 second timeout
                xhr.send(file);
            });
        });
    }
    updateProgress(percent) {
        const progressBar = this.shadowRoot.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        this.dispatchEvent(new CustomEvent('upload-progress', {
            detail: { progress: percent },
        }));
    }
    showProgress() {
        const uploadArea = this.shadowRoot.querySelector('.upload-area');
        const progress = this.shadowRoot.querySelector('.progress');
        const error = this.shadowRoot.querySelector('.error-message');
        const success = this.shadowRoot.querySelector('.success-message');
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');
        const fileInfo = this.shadowRoot.querySelector('.file-info');
        this.removeAttribute('error');
        this.removeAttribute('success');
        progress.style.display = 'block';
        fileInfo.style.display = 'block';
        error.style.display = 'none';
        success.style.display = 'none';
        uploadButton.style.display = 'none';
        retryButton.style.display = 'none';
        if (this.currentFile) {
            fileInfo.textContent = `Uploading: ${this.currentFile.name}`;
        }
    }
    showSuccess(file) {
        const uploadArea = this.shadowRoot.querySelector('.upload-area');
        const progress = this.shadowRoot.querySelector('.progress');
        const success = this.shadowRoot.querySelector('.success-message');
        const fileInfo = this.shadowRoot.querySelector('.file-info');
        const uploadButton = this.getButton('upload');
        this.setAttribute('success', '');
        progress.style.display = 'none';
        success.style.display = 'block';
        uploadButton.style.display = 'none';
        fileInfo.style.display = 'none';
        success.textContent = `✅ ${file.name} uploaded successfully!`;
        this.dispatchEvent(new CustomEvent('upload-success', {
            detail: { fileName: file.name },
        }));
    }
    showError(message) {
        const uploadArea = this.shadowRoot.querySelector('.upload-area');
        const progress = this.shadowRoot.querySelector('.progress');
        const error = this.shadowRoot.querySelector('.error-message');
        const fileInfo = this.shadowRoot.querySelector('.file-info');
        const uploadButton = this.getButton('upload');
        const retryButton = this.getButton('retry');
        this.setAttribute('error', '');
        progress.style.display = 'none';
        fileInfo.style.display = 'none';
        error.style.display = 'block';
        uploadButton.style.display = 'none';
        retryButton.style.display = 'block';
        error.textContent = message;
        this.dispatchEvent(new CustomEvent('upload-error', {
            detail: { error: message },
        }));
    }
}
customElements.define('chunkify-uploader', ChunkifyUploader);
