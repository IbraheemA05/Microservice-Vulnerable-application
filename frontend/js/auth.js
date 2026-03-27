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

const forgotPasswordForm = document.getElementById("forgot-password-form");

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = e.target.email.value;
    const feedbackEl = document.querySelector(".form-feedback");
    if (feedbackEl) feedbackEl.remove();

    try {
      const res = await fetch("/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Request failed");
      }

      const feedback = document.createElement("p");
      feedback.className = "form-feedback success";
      feedback.textContent = "If that email exists, a reset link has been sent.";
      forgotPasswordForm.prepend(feedback);
      e.target.reset();
    } catch (error) {
      const feedback = document.createElement("p");
      feedback.className = "form-feedback error";
      feedback.textContent = error.message;
      forgotPasswordForm.prepend(feedback);
    }
  });
}

const resetPasswordForm = document.getElementById("reset-password-form");

if (resetPasswordForm) {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const tokenInput = document.getElementById("token");
  if (tokenInput && token) {
    tokenInput.value = token;
  }

  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;
    const token = e.target.token.value;
    const feedbackEl = document.querySelector(".form-feedback");
    if (feedbackEl) feedbackEl.remove();

    if (password !== confirmPassword) {
      const feedback = document.createElement("p");
      feedback.className = "form-feedback error";
      feedback.textContent = "Passwords do not match";
      resetPasswordForm.prepend(feedback);
      return;
    }

    if (!token) {
      const feedback = document.createElement("p");
      feedback.className = "form-feedback error";
      feedback.textContent = "Missing reset token";
      resetPasswordForm.prepend(feedback);
      return;
    }

    try {
      const res = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Reset failed");
      }

      window.location.href = "/login.html?reset=success";
    } catch (error) {
      const feedback = document.createElement("p");
      feedback.className = "form-feedback error";
      feedback.textContent = error.message;
      resetPasswordForm.prepend(feedback);
    }
  });
}

if (loginForm) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("reset") === "success") {
    const feedback = document.createElement("p");
    feedback.className = "form-feedback success";
    feedback.textContent = "Password reset successfully. Please login with your new password.";
    loginForm.prepend(feedback);
  }
}

