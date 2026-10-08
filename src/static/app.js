document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const loginOpenButton = document.getElementById("login-open");
  const logoutButton = document.getElementById("logout-button");
  const teacherLabel = document.getElementById("teacher-label");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  let isTeacher = false;

  function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    setTimeout(() => element.classList.add("hidden"), 5000);
  }

  function updateAccountControls(username) {
    isTeacher = Boolean(username);
    loginOpenButton.classList.toggle("hidden", isTeacher);
    logoutButton.classList.toggle("hidden", !isTeacher);
    teacherLabel.classList.toggle("hidden", !isTeacher);
    signupContainer.classList.toggle("hidden", !isTeacher);
    teacherLabel.textContent = isTeacher ? `Teacher: ${username}` : "";
  }

  async function refreshSession() {
    const response = await fetch("/auth/session");
    if (!response.ok) {
      throw new Error("Unable to check teacher session");
    }
    const session = await response.json();
    updateAccountControls(session.authenticated ? session.username : null);
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) {
        throw new Error(`Activity request failed (${response.status})`);
      }
      const activities = await response.json();
      activitiesList.replaceChildren();
      activitySelect.replaceChildren(new Option("-- Select an activity --", ""));

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const title = document.createElement("h4");
        title.textContent = name;
        activityCard.appendChild(title);

        const description = document.createElement("p");
        description.textContent = details.description;
        activityCard.appendChild(description);

        const schedule = document.createElement("p");
        const scheduleLabel = document.createElement("strong");
        scheduleLabel.textContent = "Schedule: ";
        schedule.append(scheduleLabel, document.createTextNode(details.schedule));
        activityCard.appendChild(schedule);

        const availability = document.createElement("p");
        const availabilityLabel = document.createElement("strong");
        availabilityLabel.textContent = "Availability: ";
        availability.append(
          availabilityLabel,
          document.createTextNode(
            `${details.max_participants - details.participants.length} spots left`
          )
        );
        activityCard.appendChild(availability);

        const participantsContainer = document.createElement("div");
        participantsContainer.className = "participants-container";
        if (details.participants.length > 0) {
          const participantsSection = document.createElement("div");
          participantsSection.className = "participants-section";
          const participantsTitle = document.createElement("h5");
          participantsTitle.textContent = "Participants:";
          participantsSection.appendChild(participantsTitle);

          const participantsList = document.createElement("ul");
          participantsList.className = "participants-list";
          details.participants.forEach((email) => {
            const participant = document.createElement("li");
            const participantEmail = document.createElement("span");
            participantEmail.className = "participant-email";
            participantEmail.textContent = email;
            participant.appendChild(participantEmail);

            if (isTeacher) {
              const removeButton = document.createElement("button");
              removeButton.className = "delete-btn";
              removeButton.type = "button";
              removeButton.textContent = "Remove";
              removeButton.dataset.activity = name;
              removeButton.dataset.email = email;
              removeButton.addEventListener("click", handleUnregister);
              participant.appendChild(removeButton);
            }
            participantsList.appendChild(participant);
          });
          participantsSection.appendChild(participantsList);
          participantsContainer.appendChild(participantsSection);
        } else {
          const emptyMessage = document.createElement("p");
          const emptyText = document.createElement("em");
          emptyText.textContent = "No participants yet";
          emptyMessage.appendChild(emptyText);
          participantsContainer.appendChild(emptyMessage);
        }
        activityCard.appendChild(participantsContainer);
        activitiesList.appendChild(activityCard);
        activitySelect.add(new Option(name, name));
      });
    } catch (error) {
      activitiesList.textContent =
        "Failed to load activities. Please try again later.";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.currentTarget;
    const activity = button.dataset.activity;
    const email = button.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        await fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(
        messageDiv,
        "Failed to unregister. Please try again.",
        "error"
      );
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value;
    const activity = activitySelect.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" }
      );
      const result = await response.json();
      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        signupForm.reset();
        await fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginOpenButton.addEventListener("click", () => {
    loginMessage.classList.add("hidden");
    loginDialog.showModal();
  });

  document.getElementById("login-cancel").addEventListener("click", () => {
    loginDialog.close();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        showMessage(loginMessage, result.detail || "Login failed", "error");
        return;
      }
      loginForm.reset();
      loginDialog.close();
      await refreshSession();
      await fetchActivities();
      showMessage(messageDiv, result.message, "success");
    } catch (error) {
      showMessage(loginMessage, "Unable to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout request failed (${response.status})`);
      }
      updateAccountControls(null);
      await fetchActivities();
      showMessage(messageDiv, "Signed out", "success");
    } catch (error) {
      showMessage(messageDiv, "Unable to log out. Please try again.", "error");
      console.error("Error logging out:", error);
    }
  });

  async function initialize() {
    try {
      await refreshSession();
    } catch (error) {
      console.error("Error checking teacher session:", error);
    }
    await fetchActivities();
  }

  initialize();
});
