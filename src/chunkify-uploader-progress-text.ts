// src/chunkify-progress-text.ts
export class ChunkifyUploaderProgressText extends HTMLElement {
    static get observedAttributes() {
        return ['value'];
    }
    
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
        
    // Listen for parent progress updates
        this.addEventListener('upload-progress', (e: Event) => {
            const customEvent = e as CustomEvent;
            console.log('📥 Sub-component received upload-progress:', customEvent.detail.progress);
            this.setAttribute('value', Math.round(customEvent.detail.progress).toString());
        });

        // Listen for reset events
        this.addEventListener('upload-reset', () => {
            this.setAttribute('value', '0');
        });
    }
    
    attributeChangedCallback() {
        this.updateText();
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--progress-text-display, none);
                }
                
                .progress-text {
                    white-space: nowrap;
                }
            </style>
            
            <span class="progress-text">0%</span>
        `;
        
        this.updateText();
    }
    
    private updateText() {
        const value = this.getAttribute('value') || '0';
        const text = this.shadowRoot?.querySelector('.progress-text');
        if (text) {
            text.textContent = `${value}%`;
        }
    }
    
    reset() {
        this.setAttribute('value', '0');
    }
}

customElements.define('chunkify-uploader-progress-text', ChunkifyUploaderProgressText);
