const esbuild = require('esbuild');

const ssrPlugin = {
  name: 'ssr-guards',
  setup(build) {
    // Use a broader filter that will definitely catch everything
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      // Only process our chunkify-uploader files
      if (!args.path.includes('chunkify-uploader')) {
        return; // Let esbuild handle other files normally
      }
      
      const fs = require('fs');
      let code = fs.readFileSync(args.path, 'utf8');     
      // Skip if already has SSR guards
      if (code.includes('HTMLElementBase')) {
        console.log('⏭️  Skipping (already has guards):', args.path);
        return { contents: code, loader: 'ts' };
      }
      
      // Add SSR guards
      const ssrTop = `const HTMLElementBase = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as any);\n`;
      
      code = ssrTop + 
             code.replace(/extends HTMLElement/g, 'extends HTMLElementBase')
                 .replace(/customElements\.define\(([^)]+)\)/g, 
                   'if (typeof window !== "undefined") customElements.define($1 as any)');
      
      console.log('✅ Added SSR guards to:', args.path);
      return { contents: code, loader: 'ts' };
    });
  }
};

// Build all formats
Promise.all([
  esbuild.build({
    entryPoints: ['src/chunkify-uploader.ts'],
    format: 'esm',
    outdir: 'dist',
    outExtension: { '.js': '.mjs' },
    bundle: true,
    plugins: [ssrPlugin]
  }),
  esbuild.build({
    entryPoints: ['src/chunkify-uploader.ts'],
    format: 'cjs', 
    outdir: 'dist',
    outExtension: { '.js': '.cjs.js' },
    bundle: true,
    plugins: [ssrPlugin]
  }),
  esbuild.build({
    entryPoints: ['src/chunkify-uploader.ts'],
    format: 'iife',
    outdir: 'dist',
    bundle: true,
    plugins: [ssrPlugin]
  })
]).then(() => console.log('✅ Build complete with SSR guards!'));