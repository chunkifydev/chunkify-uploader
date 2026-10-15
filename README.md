<p align="center">
  <img src="https://chunkify.s3.us-east-1.amazonaws.com/logos/chunkify.png" alt="Chunkify Logo" width="300"/>
</p>

# Chunkify Uploader

Chunkify Uploader is a fully customizable web component that makes it easy to upload a video file to Chunkify.

It allows you to easily integrate a video upload UI in your application.

Chunkify Uploader supports:

- File selection
- Drag and drop for files
- Full UI Customization

> ⚠️ **Important:** A React component is also available. Check the [full documentation](https://chunkify.dev/docs/integration/uploader) to see how to use it.

## Getting started

### Install via NPM

```bash
npm install @chunkify/uploader@latest
```

### Hosted

```html
<script src="https://cdn.jsdelivr.net/npm/@chunkify/uploader"></script>
```


### Example

The CSS styling by default is very minimal so you will have to provide your own [styling](./customize) to make it looks good.

Here is a simple implementation with some simple CSS styling with a drop zone available, a file select button, a progress bar and text, an error and finally a success message.

`/your-api/create-upload-session` is a placeholder for a route you implement in your application. That route uses the official Chunkify SDK with your Project token and returns a single or multipart Upload session. Replace this path with your own backend route.

```html HTML
<style>
    chunkify-uploader {
        width: 30%;
        height: 100px;
        margin: 0 auto;
        align-items: center;
        justify-content: center;
        border: 2px dashed #ccc;
        padding: 16px;
    }

  chunkify-uploader-file-select {
        background: #007bff;
        width: 60%;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        text-align: center;
    }
</style>

<script src="https://cdn.jsdelivr.net/npm/@chunkify/uploader@latest"></script>

<chunkify-uploader drop>
    <chunkify-uploader-file-select>Select a file</chunkify-uploader-file-select>
    <chunkify-uploader-progress-text></chunkify-uploader-progress-text>
    <chunkify-uploader-progress-bar></chunkify-uploader-progress-bar>
    <chunkify-uploader-error></chunkify-uploader-error>
    <chunkify-uploader-retry>Retry</chunkify-uploader-retry>
    <chunkify-uploader-success>Upload Success!</chunkify-uploader-success>
</chunkify-uploader>

<script>
  const chunkifyUploader = document.querySelector('chunkify-uploader');
  chunkifyUploader.upload = function (file) {
    return fetch('/your-api/create-upload-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_size_bytes: file.size }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Could not create an upload session.');
        return res.json();
      });
  };
</script>
```

## Setup

Chunkify Uploader accepts a session from the Chunkify Uploads API through the `upload` JavaScript property. Your server creates the session with `file_size_bytes: file.size`. When `upload_mode` is omitted, the API defaults to `auto`: single PUT at or below 100 MiB, multipart above it. The component follows the returned mode and never chooses a threshold.

The accepted session shapes are:

```typescript
type UploadSession = {
  upload_mode: 'single';
  upload_url: string;
  completion_url: string;
  expires_at: string;
} | {
  upload_mode: 'multipart';
  completion_url: string;
  expires_at?: string;
  multipart: {
    part_size_bytes: number;
    parts: { part_number: number; upload_url: string }[];
    expires_at: string;
  };
};
```

Expiry values are ISO 8601 timestamps. Return the API's expiry fields unchanged.

Provide a fresh session for each file. You can supply an existing session object or a function that creates one after file selection.

### Example

```html 
<chunkify-uploader> ... </chunkify-uploader>

<script>
  const chunkifyUploader = document.querySelector('chunkify-uploader');
  chunkifyUploader.upload = {
    upload_mode: 'single',
    upload_url: 'PRESIGNED_UPLOAD_URL',
    expires_at: 'EXPIRY_TIMESTAMP_FROM_API',
    completion_url: 'COMPLETION_URL',
  };
</script>
```

Use the session fields returned by the API. Set the object through JavaScript; it cannot be supplied as an HTML attribute. In React, pass the same object as `upload={session}`.

You can create a session using the [Chunkify Uploads API](https://chunkify.dev/docs/api-reference/uploads/create-a-new-upload).

For single PUT, the component sends the file to `upload_url`, then sends an empty POST to `completion_url`. For multipart, it uploads slices sequentially using the returned part numbers and part size, then POSTs every part's exact ETag in ascending order:

```json
{
  "parts": [
    { "part_number": 1, "etag": "\"returned-etag\"" }
  ]
}
```

Multipart completion uses `Content-Type: application/json`. Completion sends no Project token or cookies, and success requires HTTP 204. File bytes go directly from the browser to storage. Each session belongs to one file; retries reuse that session.

### Fetching the upload session asynchronously

Depending on your workflow, you might want to create the session after the user selects a file. Set the `upload` property to a function that receives the selected File and returns a promise resolving to the session object.

***Note:*** Your backend creates sessions with a project token. Keep that token on the server and return only the session fields to the browser.


```html HTML
<chunkify-uploader>...</chunkify-uploader>

<script>
  const chunkifyUploader = document.querySelector("chunkify-uploader");
  /*
    The provider returns a promise that resolves with the upload session.
  */
  chunkifyUploader.upload = function (file) {
    /*
      Your server returns the single or multipart session fields.
      Use file.name here if your backend needs it to choose an object path.
    */
    return fetch("/your-api/create-upload-session", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_size_bytes: file.size }),
    })
    .then(res => {
      if (!res.ok) throw new Error('Could not create an upload session.');
      return res.json();
    });
  };
</script>
```

#### Server-side endpoint example

Since sessions are temporary and belong to one file, create them on demand. Here is an Express.js example. Mount this route after your application's authentication and authorization middleware.

**What this endpoint does:**

-   Receives requests from your frontend when users want to upload
-   Creates a new upload entry via Chunkify API
-   Returns the upload session to your Chunkify Uploader component

```javascript Express.js

import express from 'express';
import cors from 'cors';
import Chunkify from '@chunkify/chunkify';

const client = new Chunkify({
    projectAccessToken: process.env.CHUNKIFY_PROJECT_TOKEN,
});
const app = express();
// CORS configuration
app.use(cors({
    origin: ['http://your.frontend.url:port'],
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
  }));
const PORT = 8787;

// Middleware
app.use(express.json());
app.use(express.static('public'));

const uploadHandler = async (req, res) => {
    const { file_size_bytes } = req.body;
    if (!Number.isSafeInteger(file_size_bytes) || file_size_bytes <= 0) {
        return res.status(400).json({ error: 'A positive file_size_bytes is required.' });
    }
    try {
        const upload = await client.uploads.create({
            file_size_bytes,
        });
        // Return only the per-upload capabilities. Keep tokens and credentials on the server.
        res.set('Cache-Control', 'no-store');
        res.json(upload.upload_mode === 'multipart' ? {
            upload_mode: upload.upload_mode,
            completion_url: upload.completion_url,
            expires_at: upload.expires_at,
            multipart: upload.multipart,
        } : {
            upload_mode: upload.upload_mode,
            upload_url: upload.upload_url,
            completion_url: upload.completion_url,
            expires_at: upload.expires_at,
        });
    } catch (error) {
        res.status(502).json({ error: 'Could not create an upload session.' });
    }
};

// Set the route
app.post('/your-api/create-upload-session', uploadHandler);

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

```

This request uses the Project's default storage. Use `storage.id` to override it. Customer-connected storage requires `storage.path` including the filename, even when it is the default. Omit the path for Chunkify-managed storage. Configure the destination on your backend; see [uploader setup](https://chunkify.dev/docs/integration/uploader/setup) for request examples and bucket CORS requirements.

Sessions expire after two hours by default. Your backend can set `expires_in` between 300 and 36000 seconds.

### Storage CORS

Storage must allow your application's browser origin to make `PUT` requests with the `Content-Type` header. Multipart uploads also need `ETag` in the storage CORS **exposed response headers**, so browser JavaScript can read each successful part's ETag. Allowing the request alone is not enough. Preserve the ETag's quotation marks.

For S3-compatible storage, merge these settings into the bucket's existing CORS policy, using your application's actual origin:

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag", "Retry-After"]
  }
]
```

`Retry-After` exposure lets the component honor storage retry delays when that header is returned. Configure CORS at the storage endpoint receiving the PUT, and retain any existing playback or other application rules. Express CORS on the session route does not configure storage CORS.

### React

The same session provider works with the React wrappers. The session union and its individual types are exported from both `@chunkify/uploader` and `@chunkify/uploader/react`.

```tsx
import {
  ChunkifyUploader,
  ChunkifyUploaderFileSelect,
  ChunkifyUploaderProgressBar,
  ChunkifyUploaderError,
  ChunkifyUploaderRetry,
  ChunkifyUploaderSuccess,
  type UploadSession,
} from '@chunkify/uploader/react';

async function createUpload(file: File): Promise<UploadSession> {
  const response = await fetch('/your-api/create-upload-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_size_bytes: file.size }),
  });
  if (!response.ok) throw new Error('Could not create an upload session.');
  return response.json();
}

export function VideoUpload() {
  return (
    <ChunkifyUploader upload={createUpload} drop>
      <ChunkifyUploaderFileSelect>Select a file</ChunkifyUploaderFileSelect>
      <ChunkifyUploaderProgressBar />
      <ChunkifyUploaderError />
      <ChunkifyUploaderRetry>Retry</ChunkifyUploaderRetry>
      <ChunkifyUploaderSuccess>Upload complete</ChunkifyUploaderSuccess>
    </ChunkifyUploader>
  );
}
```

### Configure Uploader

#### Enable drag and drop

You can enable drag and drop uploads using the attribute / property `drop`. The drop zone will be the entire `<chunkify-uploader>` component.

```html HTML
<chunkify-uploader drop> ... </chunkify-uploader>
```

#### File size limit

You can configure the following attribute / property : `max-file-size` / `maxFileSize` to set the maximum size in **MB** accepted by the uploader. Any larger file will trigger an error.

```html HTML
<chunkify-uploader max-file-size="1024"> ... </chunkify-uploader>
```

## Upload events

The uploader emits events throughout the upload lifecycle, allowing you to listen and respond with custom logic.

### UI and states

The percentage measures the file transfer and stays at 100% while completion runs. The `uploading` attribute covers session preparation, transfer, and completion. Success means Chunkify has confirmed completion and created the Source.

Chunkify Uploader has a dynamic UI that changes based on the current upload state.
Here is a list of the states and their respective description:

| State     | Attribute   | Description                              |
| --------- | ----------- | ---------------------------------------- |
| Initial   | (none)      | Initial status before a file is selected |
| Uploading | `uploading` | Upload in progress                       |
| Completed | `success`   | Upload completion confirmed               |
| Error     | `error`     | Error during the upload process          |

### Events handling

#### Traditional Event Listeners

For example, you can listen to the `upload-progress` event to receive details about the progress of the upload.

```typescript Javascript
const chunkifyUploader = document.querySelector('chunkify-uploader');

chunkifyUploader.addEventListener('upload-progress', (event) => {
console.log('Upload progress is ' + event.detail.progress + '%');
});
```

#### Function Property Shortcuts

You can also use function properties provided to simplify the process if you so desire.

```typescript
const chunkifyUploader = document.querySelector('chunkify-uploader');

chunkifyUploader.onUploadProgress = (event) => {
    console.log('Upload progress is ' + event.detail.progress + '%');
};
```

Here are all the events, when they will fire, and what they hold:

| Event name        | Function Property | Trigger                           | Event detail                        |
| ----------------- | ----------------- | --------------------------------- | ----------------------------------- |
| `upload-progress` | onUploadProgress  | When upload status updates        | `{ progress: number }`              |
| `upload-error`    | onUploadError     | When upload fails                 | `{ error: string, status: number }` |
| `upload-success`  | onUploadSuccess   | When upload complete successfully | `{ file: File }`  |
| `file-selected`   | onFileSelected    | When a file is selected           | `{ file: File }`                    |

The success event contains the selected File. It does not return a Source ID; your backend can read it from the Upload or the `upload.completed` webhook.

The `upload-reset` event fires when the component resets. Call `uploader.reset()` or dispatch a `reset` event for explicit start-over. Reset cancels active browser requests, ignores pending provider results, and discards the retained file, session, and ETags. It does not delete the Upload or its stored file. The next selection needs a fresh session; replace a static session object first.

```javascript
// Wire this to your application's separate Start over control.
uploader.reset();
// Equivalent, including from a custom child control:
uploader.dispatchEvent(new CustomEvent('reset', { bubbles: true }));
```

#### Example

Here we display in the console the uploaded file name when the upload is complete or the error message and its status code when an error occurs.

```html HTML
<chunkify-uploader>
    ...
</chunkify-uploader>

<script>
    const chunkifyUploader = document.querySelector('chunkify-uploader');

    chunkifyUploader.addEventListener('upload-success', function (event) {
        console.log('Upload success for file ' + event.detail.file.name);
    });

    chunkifyUploader.addEventListener('upload-error', function (event) {
        console.log(
            'Upload error : ' +
                event.detail.error +
                ' with status ' +
                event.detail.status
        );
    });
</script>
```

### Error handling

Each transfer and completion request gets up to three total attempts for network failures, timeouts, HTTP 408, 429, and 5xx responses. Delays start at 500 ms and then 1 second. `Retry-After` can extend the delay up to 30 seconds. A larger value stops automatic retries rather than retrying before the server permits it. Completion requests time out after 30 seconds; transfers time out after 120 seconds without progress.

After automatic attempts are exhausted, `<chunkify-uploader-retry>` resumes the failed step using the retained file and session. You can also call `uploader.retry()`. Completed parts are not sent again. Once the transfer has finished, Retry only repeats completion with the same URL and body. If a completion response was lost after the server succeeded, the same completion request can return 204 without creating another Source. Retry does not request a fresh session once one has been accepted.

Retry appears when recovery is possible, indicated by the uploader's `retryable` attribute. HTTP 403 is not treated as proof of expiry and is not retried automatically. You may retry the same session after fixing permissions. A known expiry or HTTP 410 requires a new session through explicit start-over. Other non-retryable client errors, such as an invalid session or completion conflict, also require start-over. If the provider failed before returning a session, a manual retry calls it again with the retained file.

State lives only in memory. Removing the component aborts browser requests and discards the file and session, including after an error. There is no reload persistence, background upload, URL refresh, list-parts request, or storage cancellation request.

Use an empty error component for the uploader's fallback messages. Formatting whitespace inside the element does not hide the message:

```html
<chunkify-uploader-error></chunkify-uploader-error>
```

Custom content in the error component, including React children, overrides fallback messages for transfer and completion errors. The `upload-error` event always contains the detailed message and status, so your application can render errors elsewhere or update its own content. Missing multipart ETags are reported as a storage CORS configuration problem; after fixing CORS, Retry sends only the part whose ETag could not be read and any remaining parts.

***Note:*** Two types of errors are not customizable: a selected file exceeding `max-file-size`, and missing or invalid upload session configuration. When `<chunkify-uploader-error>` is present, these messages replace its custom content so the specific validation error is shown.

Calling `clear()` on the error component removes both its custom content and its fallback message.

## Styles

The examples below assume you have configured the `upload` property as shown in [Setup](#setup).

Chunkify Uploader web component is built to be fully customizable to match you project design. It comes with sub components that you will need to use to and style.

You can and must override all components CSS except the progress bar where you must use the CSS variables provided to customize it.

***Note:*** By default the main component <chunkify-uploader> is just a flex box with a flex direction sets to column.

### Chunkify uploader components list

| Name                                | Description                    | CSS Override      | Displayed When |
| ----------------------------------- | ------------------------------ | ----------------- | -------------- |
| `<chunkify-uploader>`               | Main component                 | Yes               | Always         |
| `<chunkify-uploader-file-select>`   | File selector button           | Yes               | Initial        |
| `<chunkify-uploader-heading>`       | Heading / Title                | Yes               | Initial        |
| `<chunkify-uploader-progress-text>` | Progress Percent               | Yes               | Uploading      |
| `<chunkify-uploader-progress-bar>`  | Progress Bar                   | Use CSS variables | Uploading      |
| `<chunkify-uploader-error>`         | Error message                  | Yes               | Upload Error   |
| `<chunkify-uploader-retry>`         | Retry the failed step | Yes               | Upload Error   |
| `<chunkify-uploader-success>`       | Success message                | Yes               | Upload Success |

### Minimalistic example

Here is a very basic uploader component example with just a button to upload a file.

<CodeGroup>
```html HTML
<style>
    chunkify-uploader {
        width: 10%;
        align-items: center;
        justify-content: center;
    }

    chunkify-uploader-file-select {
        background: #007bff;
        color: white;
        border: none;
        padding: 4px;
        cursor: pointer;
        text-align: center;
        width: 100%;
    }

</style>

<script src="https://cdn.jsdelivr.net/npm/@chunkify/uploader"></script>

<chunkify-uploader>
    <chunkify-uploader-file-select>Select a File</chunkify-uploader-file-select>
    <chunkify-uploader-progress-text></chunkify-uploader-progress-text>
    <chunkify-uploader-error>Upload failed</chunkify-uploader-error>
    <chunkify-uploader-success>Upload successful!</chunkify-uploader-success>
</chunkify-uploader>
```

### Use of CSS variables to customize the progress bar

The progress bar has a default appareance and color but some CSS variables are available to customize the component. This allows you to tweak the progress bar appearance:

| Name                    | CSS Property       | Description                          |
| ----------------------- | ------------------ | ------------------------------------ |
| `--progress-fill-color` | `background-color` | Color of the progress bar            |
| `--progress-background` | `background-color` | Background color of the progress bar |
| `--progress-height`     | `height`           | Height of the progress bar           |
| `--progress-width`      | `width`            | Width of the progress bar            |
| `--progress-radius`     | `border-radius`    | Radius of the progress bar           |
| `--progress-border`     | `border`           | Border of the progress bar           |

You can use them like this:

```html HTML
<style>
    chunkify-uploader {
        --progress-fill-color: red;
        --progress-background: blue;
        --progress-height: 10px;
    }
</style>

<chunkify-uploader>...</chunkify-uploader>
```

### Tailwind CSS

Include Tailwind CSS and you can start sytling with it with the `class`attribute.


```html HTML
<script src="https://cdn.tailwindcss.com"></script>

<chunkify-uploader
    class="
        h-1/2
        bg-white
        [&[dragover]]:bg-blue-100
        [&[uploading]]:bg-orange-100
        [--progress-fill-color:green]
    "
>
...
</chunkify-uploader>
```

### Enabling and customizing drag and drop UI

If you enable drag and drop uploads using the attribute / property `drop`, the drag and drop zone will be the entire `<chunkify-uploader>` component.

You can use the attribute `dragover`to style your component appropriately.

In React you can use CSS-in-JS, for example, using CSS modules.

Here is a full example with drag and drop enabled.


```HTML HTML
<style>
    chunkify-uploader {
            ...
    }

    chunkify-uploader[dragover] {
            border-color: #007bff;
            background: #e3f2fd;
    }
</style>

<chunkify-uploader drop>
       ...
</chunkify-uploader>

```

### Use attributes for state-driven customization

Chukify Uploader uses properties and attributes to manage different states changes during the upload process.

| State     | Attribute   | Description                              |
| --------- | ----------- | ---------------------------------------- |
| Initial   | (none)      | Initial status before a file is selected |
| Uploading | `uploading` | Upload in progress                       |
| Completed | `success`   | Upload completion confirmed               |
| Error     | `error`     | Error during the upload process          |

This allows to use attribute selectors for state-driven styling via CSS.

In React you can use CSS-in-JS, for example, using CSS modules.

Here is a basic example where we change the background color of the uploader when the upload is completed or in error:

```HTML HTML
<style>
    chunkify-uploader[success] {
        background: green;
    }

    chunkify-uploader[error] {
        background: red;
    }
</style>

<chunkify-uploader></chunkify-uploader>
```

### Using Events to customize UI

You can further customize UI by using events. For example, you can write a custom common error message that will display when an upload error occurs but you can fine tune it depending on the detail of the event.
Here a basic example of how to do that :

```javascript HTML
<chunkify-uploader>
    <chunkify-uploader-file-select>Select a File</chunkify-uploader-file-select>
    <chunkify-uploader-progress-text></chunkify-uploader-progress-text>
    <chunkify-uploader-error> Error during the upload</chunkify-uploader-error>
    <chunkify-uploader-success>Upload Success!</chunkify-uploader-success>
</chunkify-uploader>

<script>
    const uploader = document.querySelector('chunkify-uploader');
    const errorMsg = document.querySelector('chunkify-uploader-error');

    uploader.addEventListener('upload-error', (e) => {
              if (e.detail.status === 404) {errorMsg.textContent = "Upload URL not found"};
        });
</script>
```

In the example above the error message will be "Error during the upload" except if the status code is 404 in which case it will display "Upload URL not found".

#### Display file information

When your user select a file or when the upload completes successfully, you have access to the File object through the event.
Here is an example on how you can display these infos during the upload and on upload success, we added a ".my-file-info" div to display the info about the file that is `display: none`by default and that we set on `display: block` when the upload is in progress.

***Note:*** You will need to to use the `uploading` attribute to display the info only
    during the upload process.

```javascript
<style>
    .my-file-info {
        color: #666;
        font-size: 16px;
        margin: 10px 0;
        font-style: italic;
        display: none;
    }

    chunkify-uploader[uploading] .my-file-info {
        display: block;
    }
</style>

<chunkify-uploader drop>
    <chunkify-uploader-heading class="my-title">Drop your file here</chunkify-uploader-heading>
    <chunkify-uploader-file-select>Select File</chunkify-uploader-file-select>
    <div class="my-file-info"></div>
    <chunkify-uploader-progress-text class="my-progress-text"></chunkify-uploader-progress-text>
    <chunkify-uploader-progress-bar></chunkify-uploader-progress-bar>
    <chunkify-uploader-error class="my-error">Error during upload</chunkify-uploader-error>
    <chunkify-uploader-success class="my-success">Upload successful</chunkify-uploader-success>
</chunkify-uploader>

<script>
     const uploader = document.querySelector('chunkify-uploader');

    // Use to display file info during the upload
     uploader.onFileSelected = (e) => {
            const fileInfo = document.querySelector('.my-file-info');
            const sizeInMB = (e.detail.file.size / (1024 * 1024)).toFixed(2);
            fileInfo.textContent = `Uploading: ${e.detail.file.name} (${sizeInMB} MB)`;
        }

    // Use to display file info on upload success
    uploader.onUploadSuccess = (e) => {
            const success = document.querySelector('chunkify-uploader-success');
            success.textContent = `Upload successful for ${e.detail.file.name}`;
        }
</script>
```

## Webhooks

Chunkify Uploader is built to work with Chunkify Uploads API and its workflow. Webhooks let your backend receive upload results independently of the browser.

To learn more about webhooks, please see the complete Chunkify documentation.

### Upload process

Uploading a video file takes time and can vary depending on the size of the file and the network conditions.

Chunkify uses webhooks to notify you of your uploads statuses.

The workflow goes generally like this:

#### 1. Setup webhooks and API endpoint
- Set up a public webhook endpoint in your application to receive events from Chunkify
- Configure the webhook in your Chunkify dashboard to send events to this endpoint

#### 2. Upload the video
- Create an upload session on your server using the official Chunkify SDK and the selected file size.
- Save relevant information in your database, the upload ID for example.
- Pass the session to the `upload` property of the Chunkify Uploader (see [Setup](#setup) section).
- The component transfers the file using the returned single or multipart mode, then POSTs to the completion URL.

#### 3. Handle webhooks events
Listen for specific events:
- `upload.completed`: The upload is completed and the source is created you can start a transcoding job using the `source_id` contained in the payload.
- `upload.failed`: Chunkify rejected the upload permanently. A temporary browser or completion error can leave the Upload waiting without emitting this event.
- `upload.expired`: The Upload did not complete before expiration. The file may already have reached storage.

#### 4. Store information about the upload
Once the upload is completed and you receive the event, you can save the `source_id` found in the `upload.completed` event payload associating it with a relevant entity in your application.



> **💡 Tip:** You can pass metadata during upload creation to help with your workflow. Any metadata you include in the upload will be automatically copied to the source metadata. For example, If you want to link a source to a specific user, include the `user_id` in the upload metadata. This `user_id` will then be available in the source metadata, making it easy to track which user uploaded which content.

## Development verification

Run `npm test` with Node.js 20.19 or later. It builds the web and React bundles and TypeScript declarations, then runs DOM tests with simulated storage and completion requests. The tests cover multipart slices, progress, retries, expiry, and cancellation. Lost-response tests model the backend's idempotent completion contract; they do not contact live storage or create real Sources.
