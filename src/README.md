# Mergington High School Activities API

A FastAPI application where students can view extracurricular activities and
teachers can manage student registrations.

## Features

- View all available extracurricular activities
- View activity participants
- Teacher login for registering and unregistering students

## Getting Started

1. Install the dependencies:

   ```
   cd src
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   uvicorn app:app --reload
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

4. Provision teacher accounts from the `src` directory:

   ```
   python manage_teachers.py
   ```

   The command prompts for a username and password and stores a salted
   password hash in `teachers.json`. The file starts with no teacher accounts;
   do not add plaintext passwords or commit real teacher passwords. Restart the
   application after updating the teacher list.

5. Open the activities page. Students can view activities and participants.
   Teachers must sign in to register or unregister students. Teacher sessions
   expire after eight hours. Deploy behind HTTPS so session cookies are
   transmitted securely.

## API Endpoints

| Method | Endpoint                                                          | Description                                                          |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities and their current participants (public)          |
| POST   | `/auth/login`                                                     | Sign in as a teacher and start a session                             |
| GET    | `/auth/session`                                                   | Check whether the current browser has an active teacher session      |
| POST   | `/auth/logout`                                                    | End the current teacher session                                      |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Register a student (teacher session required)                        |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Unregister a student (teacher session required)                    |

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

Activity data and active teacher sessions are stored in memory, which means
registrations and sessions reset when the server restarts. Teacher account
password hashes are stored in `teachers.json`.
