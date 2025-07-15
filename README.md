# IRLog

IRLog is an application designed to help interventional radiology teams keep track of procedures performed. It allows users to log, view, and manage records of radiology procedures in an organized and user-friendly way.

With IRLog, you can:
- Record details of each procedure
- View and search past procedure logs
- Manage user profiles
- Access analytics and summaries of procedures

This app is built to make record-keeping easy and efficient for radiology departments.

---

## Setup Instructions

To use IRLog, you need to do a few simple things:

1. **Database:**
   - IRLog uses a PostgreSQL database to store all the information. Make sure you have access to a PostgreSQL database (you can use a free service or install it on your computer).

2. **Environment File:**
   - You need a file called `.env` in the main folder. This file stores important settings like your database connection. Here is an example of what it might look like:
     
     ```env
     DATABASE_URL=postgresql://your_username:your_password@localhost:5432/your_database
     NEXTAUTH_SECRET=your_secret_key
     NEXTAUTH_URL=http://localhost:3000
     ```
   - Replace the values with your own information.

3. **Install Dependencies:**
   - Run `npm install` to get everything the app needs.

4. **Start the App:**
   - Run `npm run dev` to start the app in development mode.
   - Open your web browser and go to [http://localhost:3000](http://localhost:3000)

If you need help with any of these steps, ask your technical team or reach out for support.
