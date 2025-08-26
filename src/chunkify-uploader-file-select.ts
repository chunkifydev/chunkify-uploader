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
                    display: var(--upload-button-display, inline-block);
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #ccc;
                    background: #f5f5f5;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font: inherit;
                    color: inherit;
                    cursor: pointer;
                    width:40%;
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