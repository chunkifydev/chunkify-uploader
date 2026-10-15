// src/chunkify-upload-button.ts
export class ChunkifyUploaderRetry extends HTMLElement {
    connectedCallback() {
        if (this.shadowRoot) return;
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupClick();
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--retry-display, none);
                    cursor: pointer;
               
                }
            </style>
            
            <slot>Retry</slot>
        `;
    }
    
    private setupClick() {
        this.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('retry', {
                bubbles: true
            }));
        });
    }
    
   
}

customElements.define('chunkify-uploader-retry', ChunkifyUploaderRetry);