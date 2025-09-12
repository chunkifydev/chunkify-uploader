// src/chunkify-upload-button.ts
export class ChunkifyUploaderFileSelect extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupClick();
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--file-select-display, block);
                    cursor: pointer;
                }
                    
            </style>
            
            <slot>Select File</slot>
        `;
    }
    
    private setupClick() {
        this.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('file-select-clicked', {
                bubbles: true
            }));
        });
    }
    
    setDisabled(disabled: boolean) {
        const button = this.shadowRoot!.querySelector('button');
        if (button) {
            button.disabled = disabled;
        }
    }
}

customElements.define('chunkify-uploader-file-select', ChunkifyUploaderFileSelect);
