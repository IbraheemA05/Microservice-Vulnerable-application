const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = e.target.email.value;
    const password = e.target.password.value;
    const feedbackEl = document.querySelector(".form-feedback");
    if (feedbackEl) feedbackEl.remove();

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Required for cookies to be sent/received
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Token is set as httpOnly cookie by backend - no need to store in localStorage
      // Redirect to dashboard
      window.location.href = "/dashboard.html";
    } catch (error) {
      const feedback = document.createElement("p");
      feedback.className = "form-feedback error";
      feedback.textContent = error.message;
      loginForm.prepend(feedback);
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = e.target.username.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;
    const feedbackEl = document.querySelector(".form-feedback");
    if (feedbackEl) feedbackEl.remove();

    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Required for cookies
        body: JSON.stringify({ username, email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // Redirect to login page on success
      window.location.href = "/login.html";
    } catch (error) {
      const feedback = document.createElement("p");
      feedback.className = "form-feedback error";
      feedback.textContent = error.message;
      signupForm.prepend(feedback);
    }
  });
}

