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

### Preferred: Run with Docker

1. **Environment File:**
   - Create a `.env` file in the main folder (if it doesn't exist). Example:
     ```env
     DATABASE_URL=postgresql://your_username:your_password@postgres:5432/your_database
     NODE_ENV=production
     NEXTAUTH_SECRET=your_secret_key
     NEXTAUTH_URL=http://localhost:3000
     POSTGRES_USER=your_username
     POSTGRES_PASSWORD=your_password
     POSTGRES_DB=your_database
     PGADMIN_DEFAULT_EMAIL=admin@example.com
     PGADMIN_DEFAULT_PASSWORD=admin123
     ```
   - Replace the values with your own information.

2. **Start with Docker Compose:**
   - Run the following command in your project directory:
     ```sh
     docker-compose up --build
     ```
   - This will start the app and all required services (like PostgreSQL) automatically.
   - Open your web browser and go to [http://localhost:3000](http://localhost:3000)

3. **Stopping the App:**
   - To stop the app, press `Ctrl+C` in the terminal and then run:
     ```sh
     docker-compose down
     ```

---

### Alternative: Run Locally (without Docker)

1. **Database:**
   - IRLog uses a PostgreSQL database to store all the information. Make sure you have access to a PostgreSQL database (you can use a free service or install it on your computer).

2. **Environment File:**
   - You need a file called `.env` in the main folder. This file stores important settings like your database connection. See the example above.
   - Replace the values with your own information.

3. **Install Dependencies:**
   - Run `npm install` to get everything the app needs.

4. **Start the App:**
   - Run `npm run dev` to start the app in development mode.
   - Open your web browser and go to [http://localhost:3000](http://localhost:3000)

If you need help with any of these steps, ask your technical team or reach out for support.
