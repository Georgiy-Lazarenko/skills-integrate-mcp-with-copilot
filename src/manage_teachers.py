"""Add a teacher account for the Mergington High School Activities API."""

import getpass
import json

from app import hash_password, load_teacher_accounts, teachers_file


def main() -> None:
    username = input("Teacher username: ").strip()
    if not username:
        raise SystemExit("Username cannot be empty.")

    accounts = load_teacher_accounts()
    if any(account["username"] == username for account in accounts):
        raise SystemExit(f"Teacher {username!r} already exists.")

    password = getpass.getpass("Teacher password (12 characters minimum): ")
    if len(password) < 12:
        raise SystemExit("Password must be at least 12 characters.")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    salt, password_hash = hash_password(password)
    accounts.append(
        {"username": username, "salt": salt, "password_hash": password_hash}
    )
    with teachers_file.open("w", encoding="utf-8") as file:
        json.dump({"teachers": accounts}, file, indent=2)
        file.write("\n")
    print(f"Added teacher {username!r}.")


if __name__ == "__main__":
    main()
