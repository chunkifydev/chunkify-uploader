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
    <chunkify-uploader-error>Upload Error</chunkify-uploader-error>
    <chunkify-uploader-success>Upload Success!</chunkify-uploader-success>
</chunkify-uploader>

<script>
  const chunkifyUploader = document.querySelector('chunkify-uploader');
  chunkifyUploader.upload = function (file) {
    return fetch('/api/upload', { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('Could not create an upload session.');
        return res.json();
      });
  };
</script>
```

## Setup

Chunkify Uploader accepts a session from the Chunkify Uploads API through the `upload` JavaScript property. The session contains `upload_url` and `completion_url`.

Provide a fresh session for each file. You can supply an existing session object or a function that creates one after file selection.

### Example

```html 
<chunkify-uploader> ... </chunkify-uploader>

<script>
  const chunkifyUploader = document.querySelector('chunkify-uploader');
  chunkifyUploader.upload = {
    upload_url: 'PRESIGNED_UPLOAD_URL',
    completion_url: 'COMPLETION_URL',
  };
</script>
```

Use the two URLs returned by the API. Set the object through JavaScript; it cannot be supplied as an HTML attribute. In React, pass the same object as `upload={session}`.

You can create a session using the [Chunkify Uploads API](https://chunkify.dev/docs/api-reference/uploads/create-a-new-upload).

The component sends the file to `upload_url` with PUT, then sends an empty POST to `completion_url` without a project token or cookies. It reports success only after completion returns 204. Each session can be used for one file; replace a supplied object before another attempt.

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
      Your server returns { upload_url, completion_url }.
      Use file.name here if your backend needs it to choose an object path.
    */
    return fetch("/api/upload", { method: "POST" })
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
    try{
        // Create the upload entry using the project's default storage.
        const response = await fetch('https://api.chunkify.dev/v1/api/uploads', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.CHUNKIFY_PROJECT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        });
        if (!response.ok) {
            return res.status(502).json({ error: 'Could not create an upload session.' });
        }
        const { data: upload } = await response.json();
        // Return the session without exposing the project token.
        const { upload_url, completion_url } = upload;
        res.set('Cache-Control', 'no-store');
        res.json({ upload_url, completion_url });
    } catch (error) {
        res.status(502).json({ error: 'Could not create an upload session.' });
    }
};

// Set the route
app.post('/api/upload', uploadHandler);

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

```

The empty request body uses the project's default storage. Set `storage_id` to override it. Customer-connected storage requires a `path` including the filename, even when it is the default. Omit `path` for Chunkify-managed storage. Configure the destination on your backend; see [uploader setup](https://chunkify.dev/docs/integration/uploader/setup) for request examples and bucket CORS requirements.

Sessions expire after two hours by default. Your backend can set `expires_in` between 300 and 36000 seconds.

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

The `upload-reset` event fires when the component resets. Reset cancels active browser requests and ignores pending provider results; it does not delete the Upload or its stored file.

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

Network failures, HTTP 429, and server errors during completion get up to three attempts with delays between them. The file is not sent again. Each completion request times out after 30 seconds. An expired completion URL returns HTTP 410, which is not retried. HTTP 403 and other client errors are not automatically retried.

The Retry control returns to file selection. The next selection needs a fresh session. A session provider creates it automatically; if you supplied an object, replace it first. A lost completion response can leave the Upload completed even when the browser reports an error. Your backend can reconcile it through a status read or webhook.

Using the `chunkify-uploader-error` sub component is the way to display errors to the user.

<CodeGroup>
```html HTML
<chunkify-uploader-error>Error: Upload Failed</chunkify-uploader-error>
```

The message "Error: Upload Failed" will be displayed when an error occurs during the upload process. If you want to customize it depending on the error you can use the `upload-error` event discussed above.
File processing errors such as `max-file-size` exceeded, API and network errors will be handled by the uploader.

***Note:*** Only two types of errors are not customizable: first if the user chose a file that exceeds the `max-file-size` and second if the upload session configuration is missing or invalid.
The error message will be displayed in both cases where the component `<chunkify-uploader-error>` has been used. For API, network, and completion errors, an empty error component remains empty; provide your own text or update it in an `upload-error` handler.

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
| `<chunkify-uploader-retry>`         | Reset to initital state button | Yes               | Upload Error   |
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
- Create an upload session using Chunkify API.
- Save relevant information in your database, the upload ID for example.
- Pass the session to the `upload` property of the Chunkify Uploader (see [Setup](#setup) section).
- The component sends the file with PUT, then calls the completion URL with POST.

#### 3. Handle webhooks events
Listen for specific events:
- `upload.completed`: The upload is completed and the source is created you can start a transcoding job using the `source_id` contained in the payload.
- `upload.failed`: Chunkify rejected the upload permanently. A temporary browser or completion error can leave the Upload waiting without emitting this event.
- `upload.expired`: The Upload did not complete before expiration. The file may already have reached storage.

#### 4. Store information about the upload
Once the upload is completed and you receive the event, you can save the `source_id` found in the `upload.completed` event payload associating it with a relevant entity in your application.



> **💡 Tip:** You can pass metadata during upload creation to help with your workflow. Any metadata you include in the upload will be automatically copied to the source metadata. For example, If you want to link a source to a specific user, include the `user_id` in the upload metadata. This `user_id` will then be available in the source metadata, making it easy to track which user uploaded which content.
