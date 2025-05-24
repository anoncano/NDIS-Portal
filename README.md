# NDIS Support Portal

This is a web-based portal designed to assist NDIS (National Disability Insurance Scheme) support workers and administrators with managing client information, services, invoicing, and service agreements.

## Features

* **Authentication**: Secure login and registration for users.
* **User Roles**:
    * **Support Worker**: Manage their profile, log shifts, create invoices, manage service agreements.
    * **Administrator**: Manage global portal settings, NDIS service definitions, worker approvals, service agreement templates, and view/manage worker data.
* **Profile Management**: Users can manage their personal and banking details, and upload supporting documents.
* **Invoice Generation**: Create and manage invoices for services rendered, with automated calculations for hours and totals. GST calculation based on registration status. PDF download for invoices.
* **Service Agreements**: Customizable service agreement templates. Digital signature capture for workers and participants (or admin on behalf of participant). PDF download for agreements.
* **Shift Logging & Requests**: (Basic UI elements present, full functionality can be expanded)
    * Workers can request shifts.
    * Workers can log new shifts directly to an invoice.
* **Admin Dashboard**:
    * **Global Settings**: Configure portal name, organization details, default participant information, etc.
    * **NDIS Service Management**: Define NDIS service items with codes, descriptions, categories, and multiple rate types (weekday, evening, weekend, public holiday, flat rates).
    * **Agreement Customization**: Edit the clauses and overall title of the service agreement template using placeholders.
    * **Worker Management**: Approve new worker registrations and manage the NDIS services each worker is authorized to provide.
* **Responsive Design**: UI adapts to different screen sizes for use on desktop and mobile devices.
* **Firebase Integration**: Uses Firebase for authentication, Firestore database, and Firebase Storage for file uploads.

## Tech Stack

* HTML5
* CSS3 (custom styling, Font Awesome for icons)
* JavaScript (ES6 Modules)
* Firebase (Authentication, Firestore, Storage)
* html2pdf.js (for PDF generation)

## Project Setup

### 1. Firebase Project

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one).
2.  **Enable Firebase Services**:
    * **Authentication**: Enable "Email/Password" sign-in method.
    * **Firestore**: Create a Firestore database. Start in **test mode** for initial development ( `allow read, write: if true;` ). **For production, you MUST set up proper security rules.**
        * Example Firestore path structure used:
            * Global Settings: `/artifacts/{appId}/public/settings` (document)
            * NDIS Services: `/artifacts/{appId}/public/services/{serviceId}` (collection of documents)
            * Error Logs: `/artifacts/{appId}/public/logs/errors/{logId}`
            * User Profiles: `/artifacts/{appId}/users/{userId}/profile/details` (document)
            * User Invoice Drafts: `/artifacts/{appId}/users/{userId}/invoices/draft` (document)
            * User Agreements: `/artifacts/{appId}/users/{userId}/agreement/details` (document)
            * User Files: `artifacts/{appId}/users/{userId}/profileDocuments/{fileName}` (in Firebase Storage)
    * **Storage**: Enable Firebase Storage for file uploads.
3.  **Get Firebase Configuration**:
    * In your Firebase project, go to Project Settings (gear icon).
    * Under "Your apps", click the web icon (`</>`) to add a web app (if you haven't already).
    * Register the app and Firebase will provide you with a `firebaseConfig` object. You'll need these values.

### 2. Configure the Application

1.  **`index.html`**:
    * Locate the `window.firebaseConfigForApp` object near the top of the `<head>` section.
    * Replace the placeholder values (`YOUR_API_KEY`, `YOUR_PROJECT_ID`, etc.) with the actual values from your Firebase project's configuration.
    * **Security Note**: For local development, this is acceptable. For production, it's highly recommended to use environment variables or a secure mechanism to inject this configuration rather than hardcoding it directly in `index.html`. The script already prioritizes `__firebase_config` if provided by the hosting environment (like the Canvas).

2.  **Admin Email (Important for First Admin)**:
    * In `script.js`, the `getDefaultGlobalSettings()` function has an `adminEmail` field (e.g., `"admin@portal.com"`).
    * The first user who registers with this email address will be automatically designated as an administrator.
    * You might want to change this default admin email in the code before the first run, or the first admin can later change it via the Admin > Global Settings panel.

### 3. Running Locally

1.  Ensure you have a local web server to serve the files (e.g., Live Server extension in VS Code, Python's `http.server`, or `npx serve`).
2.  Open `index.html` in your browser through the local server.

### 4. Deployment (Example: GitHub Pages for static assets)

The repository includes a GitHub Actions workflow (`.github/workflows/static.yml`) for deploying static content to GitHub Pages. This is suitable for the HTML, CSS, and JS client-side files.

* **Important**: GitHub Pages serves static files. The dynamic backend (Firebase) is separate.
* If deploying to GitHub Pages or a similar static host, ensure your Firebase project's authorized domains in the Firebase Authentication settings include the domain where your app will be hosted.
* For production environments, you would typically build and deploy the application using a CI/CD pipeline that can securely inject the Firebase configuration (e.g., as the `__firebase_config` JavaScript variable).

## Key Firestore Data Structures

* **Global Settings**: `/artifacts/{appId}/public/settings` (single document)
    * Stores portal-wide configurations like title, default participant details, admin email, agreement template.
* **NDIS Services**: `/artifacts/{appId}/public/services/{serviceId}`
    * Each document represents an NDIS service item with its code, description, category, rates, etc.
* **User Profiles**: `/artifacts/{appId}/users/{userId}/profile/details`
    * Stores user-specific information: name, ABN, bank details, GST status, approval status, admin status, uploaded files metadata, next invoice number, authorized NDIS services.
* **User Agreements**: `/artifacts/{appId}/users/{userId}/agreement/details`
    * Stores the signed service agreement details for a user, including signatures, dates, and a snapshot of the agreement content.
* **User Invoice Drafts**: `/artifacts/{appId}/users/{userId}/invoices/draft`
    * Stores the current working draft of an invoice for a user.

## Development Notes

* **Error Logging**: Errors are logged to the `/artifacts/{appId}/public/logs/errors` collection in Firestore for easier debugging in deployed environments.
* **Modals**: The application uses custom modals for alerts, confirmations, wizards, and data input (like signatures). Standard browser `alert()` and `confirm()` are avoided.
* **Placeholders**: Some advanced functionalities (e.g., detailed shift request management, complex admin reports) might have UI elements or stubs in the code but require further implementation.
* **Security Rules**: **Crucial for production.** The default Firestore security rules are too open. You must configure rules to properly secure user data (e.g., users can only write to their own profile, admins have broader access). Example:
    ```json
    // Basic Firestore Security Rules (Illustrative - Expand based on needs)
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Public data (settings, services, logs)
        match /artifacts/{appId}/public/{document=**} {
          allow read: if true; // Publicly readable
          allow write: if request.auth != null && get(/databases/$(database)/documents/artifacts/$(appId)/users/$(request.auth.uid)/profile/details).data.isAdmin == true; // Only admins can write
        }
        // User-specific data
        match /artifacts/{appId}/users/{userId}/{document=**} {
          allow read, write: if request.auth != null && request.auth.uid == userId; // User can read/write their own data
          allow read: if request.auth != null && get(/databases/$(database)/documents/artifacts/$(appId)/users/$(request.auth.uid)/profile/details).data.isAdmin == true; // Admins can read any user's data
        }
      }
    }
    ```
    Firebase Storage also requires security rules.

This README should provide a good starting point for understanding, setting up, and further developing the NDIS Support Portal.
