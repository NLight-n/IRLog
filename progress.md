# Project Progress Log

## Completed Features/Changes

- Switched authentication/session management to NextAuth.js with JWT strategy.
- Implemented session propagation and permission checks using next-auth/jwt getToken in API routes.
- Main Procedure Log page:
  - Navigation bar with Home and Settings links.
  - Filter card with search, modality, procedure name, and date filters.
  - Procedure log table with all required columns and permission-based actions.
  - Add/Edit modal for procedure logs, using normalized schema (procedureRef).
- Settings page with tabbed interface:
  - Procedures tab: Full CRUD (add, edit, delete) for procedures, with dropdowns for status and modality.
  - Physicians tab: Full CRUD for physicians, with two tables (IR and Referrer) and dropdown for role.
  - User Management tab: Full CRUD for users, with permissions as checkboxes and password hashing.
  - Data Log tab: Complete audit trail implementation with filters, pagination, and detailed before/after modal.
- All backend API routes for CRUD (procedures, physicians, users) with proper permission checks.
- Comprehensive audit logging system for all CUD operations across procedures, physicians, and users.
- UI/UX improvements: removed redundant columns, clarified table headings, and ensured all forms are controlled and robust.
- Fixed ghost column persistence and zebra striping issues in the procedure log table.
- Fixed runtime error in UserProfileSidebar caused by null column context.

## Pending Features/Changes

- General Settings tab: Implement CRUD for timezone, language, theme, and column preferences.
- User Management: Add role as a dropdown (currently a text input), and implement password reset (admin can set temp password).
- Procedure Log: Add export to PDF/Excel functionality.
- Procedure Log: Add clickable notes for attached files (PDF/Image preview).
- Analytics page: Implement trends/census, graphs, and filters as per specification.
- Settings: Allow column visibility/order preferences to be saved per user.
- Additional validation, error handling, and UI polish as needed.

---
_Last updated: [auto-generated]_ 




Pending things:
>- user profile page
>- Implementing currency, apphead&subheading, date & time format globally.
>- Procedures tab - IP tag color change
>- User management (authentication issues)
>- Data log
>- Procedure name - autocomplete - background change
>- Move general settings to user profile.
>- Sticky horizontal scrolling in main page for the procedure log table.
>- Export to PDF / Excel (dynamic content based on filters)
>- Graphs implementation
- Remove unnecessary dependencies.
- Docker deployment - production build

