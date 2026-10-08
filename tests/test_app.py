import asyncio
import copy
import json
import unittest
from urllib.parse import urlsplit
from unittest.mock import patch

from src import app as app_module


class TeacherAccessTests(unittest.TestCase):
    def setUp(self):
        self.original_activities = copy.deepcopy(app_module.activities)
        self.original_sessions = app_module.sessions.copy()
        self.account_salt, self.account_hash = app_module.hash_password(
            "correct horse battery"
        )
        self.accounts_patch = patch.object(
            app_module,
            "load_teacher_accounts",
            return_value=[
                {
                    "username": "teacher",
                    "salt": self.account_salt,
                    "password_hash": self.account_hash,
                }
            ],
        )
        self.accounts_patch.start()
        app_module.sessions.clear()

    def request(self, method, url, body=None, cookie=None):
        parsed_url = urlsplit(url)
        body_bytes = json.dumps(body).encode() if body is not None else b""
        headers = []
        if body is not None:
            headers.append((b"content-type", b"application/json"))
        if cookie:
            headers.append((b"cookie", f"teacher_session={cookie}".encode()))
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": parsed_url.path,
            "raw_path": parsed_url.path.encode(),
            "query_string": parsed_url.query.encode(),
            "root_path": "",
            "headers": headers,
            "server": ("testserver", 80),
            "client": ("testclient", 12345),
        }
        messages = []
        body_sent = False

        async def receive():
            nonlocal body_sent
            if body_sent:
                return {"type": "http.disconnect"}
            body_sent = True
            return {
                "type": "http.request",
                "body": body_bytes,
                "more_body": False,
            }

        async def send(message):
            messages.append(message)

        asyncio.run(app_module.app(scope, receive, send))
        response_start = next(
            message for message in messages if message["type"] == "http.response.start"
        )
        response_body = b"".join(
            message.get("body", b"")
            for message in messages
            if message["type"] == "http.response.body"
        )
        response_headers = {
            key.decode().lower(): value.decode()
            for key, value in response_start["headers"]
        }
        payload = json.loads(response_body) if response_body else None
        return response_start["status"], response_headers, payload

    @staticmethod
    def session_cookie(response_headers):
        return response_headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]

    def tearDown(self):
        self.accounts_patch.stop()
        app_module.activities.clear()
        app_module.activities.update(self.original_activities)
        app_module.sessions.clear()
        app_module.sessions.update(self.original_sessions)

    def test_students_can_view_but_not_change_registrations(self):
        participants = app_module.activities["Chess Club"]["participants"].copy()

        self.assertEqual(self.request("GET", "/activities")[0], 200)
        self.assertEqual(
            self.request(
                "POST",
                "/activities/Chess Club/signup?email=student%40mergington.edu",
            )[0],
            401,
        )
        self.assertEqual(
            self.request(
                "DELETE",
                f"/activities/Chess Club/unregister?email={participants[0]}",
            )[0],
            401,
        )
        self.assertEqual(
            app_module.activities["Chess Club"]["participants"], participants
        )

    def test_teacher_can_register_and_unregister_students(self):
        login_status, login_headers, _ = self.request(
            "POST",
            "/auth/login",
            body={"username": "teacher", "password": "correct horse battery"},
        )
        self.assertEqual(login_status, 200)
        self.assertIn("httponly", login_headers["set-cookie"].lower())
        self.assertIn("samesite=strict", login_headers["set-cookie"].lower())
        session_token = self.session_cookie(login_headers)

        signup_response = self.request(
            "POST",
            "/activities/Chess Club/signup?email=student%40mergington.edu",
            cookie=session_token,
        )
        self.assertEqual(signup_response[0], 200)
        self.assertIn(
            "student@mergington.edu",
            app_module.activities["Chess Club"]["participants"],
        )

        unregister_response = self.request(
            "DELETE",
            "/activities/Chess Club/unregister?email=student%40mergington.edu",
            cookie=session_token,
        )
        self.assertEqual(unregister_response[0], 200)
        self.assertNotIn(
            "student@mergington.edu",
            app_module.activities["Chess Club"]["participants"],
        )

    def test_invalid_login_and_logout_do_not_leave_access(self):
        invalid_response = self.request(
            "POST",
            "/auth/login",
            body={"username": "teacher", "password": "incorrect password"},
        )
        self.assertEqual(invalid_response[0], 401)
        self.assertEqual(
            self.request(
                "POST",
                "/activities/Chess Club/signup?email=student%40mergington.edu",
            )[0],
            401,
        )

        _, login_headers, _ = self.request(
            "POST",
            "/auth/login",
            body={"username": "teacher", "password": "correct horse battery"},
        )
        session_token = self.session_cookie(login_headers)
        session_status, _, session = self.request(
            "GET", "/auth/session", cookie=session_token
        )
        self.assertEqual(session_status, 200)
        self.assertTrue(session["authenticated"])
        self.assertEqual(self.request("POST", "/auth/logout", cookie=session_token)[0], 200)
        self.assertFalse(
            self.request("GET", "/auth/session", cookie=session_token)[2][
                "authenticated"
            ]
        )
        self.assertEqual(
            self.request(
                "POST",
                "/activities/Chess Club/signup?email=student%40mergington.edu",
                cookie=session_token,
            )[0],
            401,
        )


if __name__ == "__main__":
    unittest.main()
