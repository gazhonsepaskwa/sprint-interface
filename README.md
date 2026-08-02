# Sprint management platform for tutors
Disclamer : Not affiliated with 42, just using the API available to students

<img width="1020" height="1017" alt="image" src="https://github.com/user-attachments/assets/05263faf-6056-4fba-a052-5b5aca97c022" />
<img width="2056" height="705" alt="image" src="https://github.com/user-attachments/assets/58404ab4-094a-4ec1-abc3-9ced51b98e76" />
<img width="685" height="409" alt="image" src="https://github.com/user-attachments/assets/1d6aab96-12cd-4c43-868d-437fceb19536" />

exemple env var : ( see backend/.env.exemple )
# PostgreSQL
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=db
DB_NAME=sprint_db
DB_PORT=5432
PORT=5001

# 42 API Credentials
# Create an app at https://profile.intra.42.fr/oauth/applications
FORTYTWO_APP_ID=your_client_id_here
FORTYTWO_APP_SECRET=your_client_secret_here
FORTYTWO_APP_REDIRECT_URI=http://localhost:5001/api/auth/42/callback
FORTYTWO_CAMPUS_ID=52

# App Configuration
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=a_long_random_string_here
SUPERUSER_LOGIN=nalebrun

Made with AI.
