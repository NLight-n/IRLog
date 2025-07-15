# Interventional Radiology Procedure Log - Final Specification & Architecture

This document provides a comprehensive specification and technical architecture for the Interventional Radiology Procedure Log application.

---

## 1. Application Specification 

### 1.1. Tech Stack

- **Frontend/Backend:** Next.js (SSR, API routes, and backend logic).
- **Database:** PostgreSQL.
- **ORM:** Prisma ORM.
- **File Storage:** MinIO (for storing documents like PDFs/images).

---

### 1.2. Core Features & Changes

#### 1.2.1. Authentication

- **Login Page:**
  - Fields: Username and Password.
  - Admin creates users (no signup option). Admin assigns roles and permissions at user creation.
  - Password reset - only by admin.
  
- **User Profile Page (modal):**
  - **Editable Fields:** Change username, email, password.

---

#### 1.2.2. Main Procedure Log Page

- **Filters/Search Bar (Top):**
  - **Search Box:**  
    - **Search as you type** for:
      - `patientName`
      - `patientID`
      - `procedureName`
      - `Diagnosis`
  - **Procedure Modality Filter:** Filter by modality (USG, CT, OT, Fluoroscopy, DSA).
  - **Procedure Name Filter:** Drop-down list populated dynamically from the database.
  - **Date Filter:** Filter by date (All, Today, Yesterday, Last 3 Days, Last 7 Days, Last 1 Month, Last 1 Year, Custom Date Range).
  
- **Main Table (Procedure Log):**  
  - **Columns:**
    1. **Patient ID**
    2. **Patient Name**
    3. **Patient Age/Sex**
    4. **Patient Status** (IP or OP)
    4. **Modality**
    5. **Procedure Name**
    6. **Procedure Date**
    7. **Procedure Time**
    8. **Done By**  
       - Can list multiple IRs if necessary.
    9. **Referring Physician**
    10. **Diagnosis** 
    11. **Procedure Notes** (optional, clickable to open attached file PDF/Image).
    12. **Follow-up** (optional).
    13. **Notes** (optional).
    14. **Procedure Cost** (Optional).
    15. **Actions:**
        - Icon (`>>>`) to open detailed procedure log (view/edit/delete based on permission).

- **Actions:**
  - **Add Procedure Log Button** (opens a modal to create a new log entry).
  - **Export Button** (PDF/Excel export with applied filters).

- **Dark/Light Mode Toggle** (top-right corner).
- **User Profile Icon** (top-right corner).
- **Settings Icon** (top-right corner).

---

#### 1.2.3. Procedure Details Modal (From Main Page)

- When clicking on the `>>>` icon, show the following details:
  - **Patient Info:**
    - `Patient ID`, `Patient Name`, `Age/Sex`.
  - **Procedure Info:**
    - `Patient Status`, `Modality`, `Procedure Name`, `Procedure Date`, `Procedure Time`.
  - **Done By (multiple IRs)**.
  - **Referring Physician**.
  - **Diagnosis**.
  - **Procedure Notes** (Separate column showing the preview of the attached document).
  - **Follow-up** (if any).
  - **Notes** (if any).
  - **Procedure Cost** (if any).
  - **Metadata:**
    - `Created By`, `Last Updated`.

- **Options:**
  - **Edit** (only authorized users with the `EditProcedureLog` permission).
  - **Delete** (only authorized users with the `EditProcedureLog` permission).

---

#### 1.2.4. Analytics Page

- **Trends/Census:**
  - **Monthly Trends:** Graph showing the total number of procedures per month.
  - **By Modality:** Procedures per modality (USG, CT, OT, etc.).
  - **By Referring Physician:** Procedures referred by each physician.
  
- **Filters:**
  - Date Range filter (same as in the main page).
  - Modality filter.

- **Data Visualization:** Graphs/charts (bar charts, pie charts) to show trends, modality breakdown, etc.

---

#### 1.2.5. Settings Page

- **General Settings:**
  - **Accessible by All Users**.
  - Settings: Timezone, Language, Theme Preferences (Dark/Light).
  
  - **Column Visibility and Order (User Preference):**
    - Toggle visibility and reorder columns (e.g., Procedure Name, Diagnosis, Patient ID) in the main table.
    - Each user can set their preferred column order and visibility. These preferences are saved per user.

- **Physician Management:**
  - **Tab within Settings**:
    - Two sections for **IRs** and **Referring Physicians** within the same tab.
  
  - **IRs & Referring Physicians Management:**
    - **Fields:** Name, Credentials, Department.
    - Role field with a dropdown to choose between **IR** or **Referring Physician**.
    - Admin can add/edit/delete physicians in both lists.
  
  - **Add/Edit Physician** (modal form for adding or editing - requires EditSettings permission).

  **Procedure management :**
  - Lists all the procedures in the database.
  - Filters - by patient status (IP or OP), modality, searchbox (search as you type)
  - Options to do CRUD operations (requires 'EditSettings' permission)
  - Fields - patient status, modality, procedureName, procedureCost (optional)

- **Data Log (Audit Trail - requires EditSettings permission):**
  - Log for CRUD actions done by any user (timestamp, user, action type).
  - Filters to narrow down content.
  - Clicking on a row should show a modal page showing before and after data.

- **User Management (Visible Only to Admin):**
  - Admin can manage users (create/edit/delete users).
  - Admin can assign roles and permissions (checkboxes for permissions).
  - Reset and create a temp password for a user

---

#### 1.2.6. User Management & Permissions

- **Permission-Based Access Control:**
  - **Permissions** (checkboxes):
    - **ViewOnly** (default for all users): Can only view the main procedure table, analytics, procedure details, and physicians list.
    - **CreateProcedureLog**: Permission required to create a new procedure log.
    - **EditProcedureLog**: Permission required to edit or delete a procedure log in the Procedure Details modal.
    - **EditSettings**: Permission required to edit the Physicians tab and view the Data Log.
    - **ManageUsers**: Permission required for the **User Management** subtab visibility and creating/editing users (assign roles, permissions).
  
  - **Assigning Permissions:**
    - Only an **admin** user can assign the `ManageUsers` permission to another user.
    - Admin can assign `ViewOnly` by default to all users, and optionally assign specific permissions like `CreateProcedureLog`, `EditProcedureLog`, `EditSettings`.

  - **Admin User:** 
    - Admin can create users and assign roles and permissions during user creation.
    - Admin has full control over users, procedures, and settings.

---

### 1.3. Database Schema

- **Users Table:**
  - `userID`, `username`, `password`, `email`, `role`, `permissions (checkboxes)`, `createdAt`, `updatedAt`.

- **ProcedureLog Table:**
  - `procedureID`, `patientID`, `patientName`, `patientAge`, `patientSex`, `modality`, `procedureName` (proID - foreign key to Procedures Table), `procedureDate`, `procedureTime`, `doneBy`(stores physicianIDs), `refPhysician`, `procedureNotesText`, `procedureNotesFilePath`, `followUp`, `notes`, `procedureCost`, `diagnosis`, `createdAt`, `updatedAt`.

- **Physicians Table (For both IRs and Referring Physicians):**
  - `physicianID`, `name`, `credentials`, `department`, `role (IR/Referrer)`, `createdAt`, `updatedAt`.

- **ProcedurePhysicians Table (Join Table for Many-to-Many):**
  - `procedureID` (foreign key to Procedures)
  - `physicianID` (foreign key to Physicians)

- **Procedure Table:**
  - `proID`, `patientStatus`, `modality`, `procedureName`, `timestamp`.

- **Permissions Table:**
  - `userID`, `permission (checkboxes for ViewOnly, CreateProcedureLog, EditProcedureLog, EditSettings, ManageUsers)`, `timestamp`.

- **AuditLog Table:**
  - `logID`, `actionType`, `userID`, `affectedTable`, `affectedRowID`, `dataBefore` (JSON), `dataAfter` (JSON), `timestamp`.

---

### 1.4. UI Design / Layout Suggestions

- **Main Page Layout:**
  - **Header:** Logo, dark/light toggle, user profile icon, settings icon.
  - **Filters/Search Bar:** Positioned at the top of the table.
  - **ProcedureLog Table:** Columns for each procedure, sortable and filterable.
  - **Procedure Details Modal:** Displays a detailed procedure view with options to edit and delete (if permissions allow).

---
---

## 2. Architecture 

### 2.1. Project Directory Structure

/project-root
│
├── /components                    # Reusable UI components
│   ├── /common                    # Common components (Button, Modal, etc.)
│   ├── /layout                    # Layout components (Header, Footer, Sidebar)
│   ├── /modals                    # Modals (Add Procedure Log, Edit Procedure Log)
│   └── /tables                    # Table components (Main Table, Procedure Details Table)
│
├── /lib                           # Utilities and helpers
│   ├── /auth                      # Authentication helpers
│   ├── /prisma                    # Prisma database client setup
│   └── /storage                   # MinIO file storage helpers
│
├── /pages                         # Next.js Pages (automatically routes)
│   ├── /api                       # API Routes (Backend logic for CUD operations)
│   │   ├── /auth                  # Authentication API routes (login, signup, logout)
│   │   ├── /procedures            # Procedure-related API (CRUD operations)
│   │   ├── /users                 # User management API (create, edit, delete users)
│   │   ├── /settings              # Settings API
│   │   └── /audit-log             # Audit log API│   │
│   ├── /_app.tsx                   # Main App component (global layout, session, etc.)
│   ├── /_document.js               # Custom document setup (for hydration fix if needed)
│   ├── /index.tsx                  # Main page (procedure log table)
│   ├── /analytics.tsx              # Analytics page
│   ├── /login.tsx                  # Login page
│   ├── /profile.tsx                # User Profile page (edit profile)
│   ├── /settings.tsx               # Settings page
│   └── /user-management.tsx        # User management page (Admin only)
│
├── /prisma                        # Prisma Schema and migrations
│   ├── /migrations                # Database migrations
│   └── schema.prisma              # Prisma schema for the database models
│
├── /public                        # Static files (images, fonts, etc.)
│
├── /styles                        # Global styles (CSS or SCSS)
│   ├── /global.css                # Global styles
│   └── /theme.css                 # Theme-related (light/dark mode)
│
├── /utils                         # Utility functions (filters, search, etc.)
│   ├── /columnUtils.js            # Column visibility & ordering utils
│   ├── /permissionUtils.js        # Permission-related helper functions
│   └── /dataExport.js             # Export data (PDF/Excel)
│
├── .env                           # Environment variables (database, MinIO credentials)
├── .gitignore                     # Git ignore file
├── next.config.js                 # Next.js configuration file
├── package.json                   # NPM dependencies
└── tsconfig.json

---

### 2.2. Key Decisions & Rationale

1.  **Next.js for Full-Stack:**
    - **Why:** Simplifies development by having both frontend and backend in one project. SSR improves performance and SEO. API routes are easy to set up.
    - **Alternative:** Separate frontend (React) and backend (Node.js/Express). This adds complexity but can be more scalable for very large applications.

2.  **Prisma ORM:**
    - **Why:** Type-safe database access, easy migrations, and a clean API. Reduces boilerplate code for database operations.
    - **Alternative:** SQL queries directly. More control but less type safety and more verbose.

3.  **MinIO for File Storage:**
    - **Why:** Self-hosted, S3-compatible object storage. Good for storing files like PDFs and images securely. All user-uploaded content will be managed via MinIO, not stored in the project's public directory.
    - **Alternative:** Storing files in the database (not recommended for large files) or using a cloud service like AWS S3.

4.  **Permission-Based Access Control:**
    - **Why:** Granular control over user actions. More flexible than role-based access control (RBAC) because permissions can be mixed and matched.
    - **Alternative:** Simple role-based access (Admin, User). Less flexible.

5.  **Component-Based Architecture:**
    - **Why:** Reusable UI components make the code cleaner and easier to maintain. Follows modern frontend development practices.
    - **Alternative:** Monolithic components. Harder to reuse and test.

---

### 2.3. Data Flow Example: Adding a New Procedure

- **Frontend**: Uses `useSession` from NextAuth to get user/permissions.
- **API Route**: Uses `getServerSession` to check session and permissions.
- **No JWT tokens** are sent in headers; session is managed by NextAuth cookies.

---

### 2.4. Security Considerations

- **Authentication:** NextAuth.js session/cookie-based.
- **Authorization:** All API routes check session and permissions via NextAuth.
- **Input Validation:** All user input will be validated on both the client and server (e.g., using a library like Zod) to prevent XSS and other injection attacks.
- **File Uploads:** File uploads will be handled securely by a pre-signed URL flow with MinIO. File types and sizes will be validated on the server.
