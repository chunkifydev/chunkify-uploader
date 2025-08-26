// src/chunkify-upload-button.ts
export class ChunkifyUploaderRetry extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupClick();
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--retry-display, none);
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
            
            <slot>Retry</slot>
        `;
    }
    
    private setupClick() {
        this.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('reset', {
                bubbles: true
            }));
        });
    }
    
   
}

customElements.define('chunkify-uploader-retry', ChunkifyUploaderRetry);