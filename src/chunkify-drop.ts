// src/chunkify-drop.ts
export class ChunkifyDrop extends HTMLElement {
    private uploader: HTMLElement | null = null;
    
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupDragAndDrop();
        
        // Find parent uploader
        this.uploader = this.closest('chunkify-uploader');
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--drop-display, flex);
                }
            </style>
            
            <slot></slot>
        `;
    }
    
    private setupDragAndDrop() {
         
        // Drag and drop
        this.addEventListener('dragover', this.handleDragOver);
        this.addEventListener('dragleave', this.handleDragLeave);
        this.addEventListener('drop', this.handleDrop);
    }
    
    private handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        if (!this.hasAttribute('disabled')) {
            this.setAttribute('dragover', '');
        }
    };
    
    private handleDragLeave = () => {
        this.removeAttribute('dragover');
    };
    
    private handleDrop = (e: DragEvent) => {
        e.preventDefault();
        this.removeAttribute('dragover');
        
        if (!this.hasAttribute('disabled') && this.uploader) {
            const file = e.dataTransfer?.files[0];
            if (file) {
                this.uploader.dispatchEvent(new CustomEvent('file-dropped', {
                    detail: { file },
                    bubbles: true
                }));
            }
        }
    };
    
    setDisabled(disabled: boolean) {
        if (disabled) {
            this.setAttribute('disabled', '');
        } else {
            this.removeAttribute('disabled');
        }
    }
}

customElements.define('chunkify-drop', ChunkifyDrop);