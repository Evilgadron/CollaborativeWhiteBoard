import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../Auth.css";
import { useAuth } from '../../context/AuthContext';

const Auth = ({ isLogin }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    if (!isLogin) {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
        return;
      }
    }

    try {
      const endpoint = isLogin ? "login" : "register";
      const body = isLogin
        ? { email: formData.email, password: formData.password }
        : {
          name: formData.username,
          email: formData.email,
          password: formData.password,
        };

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/auth/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data));
        localStorage.setItem('token', data.token);

        login(data);

        setSuccess(
          isLogin ? "Login successful!" : "Account created successfully!"
        );

        const redirectPath = localStorage.getItem('redirectAfterLogin');
        localStorage.removeItem('redirectAfterLogin');

        setTimeout(() => {
          navigate(redirectPath || '/home');
        }, 1500);
      } else {
        setError(
          data.message ||
          `${isLogin ? "Login" : "Signup"} failed. Please try again.`
        );
      }
    } catch (error) {
      setError("Connection error. Please check your internet and try again.");
      console.error("Network error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    localStorage.setItem('returnTo', '/home');
    window.location.href = `${process.env.REACT_APP_API_URL}/api/auth/google`;
  };

  return (
    <div className="auth-main-center dark-bg">
      <div className={`auth-card dark-card ${isLogin ? 'login-form' : 'signup-form'}`}>
        <div className="branding-header text-center mb-5">
          <div className="logo-container">
      
            <div className="branding-text">
              <h1>SyncBoard</h1>
              <p className="tagline">Multi-Device Synchronized Whiteboard Player</p>
            </div>
          </div>
        </div>

        <div className="login-header text-center mb-4">
          <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>
          <p>
            {isLogin
              ? "Sign in to continue your musical journey"
              : "Join the music revolution today"}
          </p>
        </div>

        <button
          type="button"
          className="google-login-btn"
          onClick={handleGoogleLogin}
          aria-label="Continue with Google"
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            className="google-icon"
          />
          Continue with Google
        </button>

        <div className="divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder=" "
                required
                aria-label="Username"
                autoComplete="username"
              />
              <label htmlFor="username">Username</label>
            </div>
          )}

          <div className="form-group">
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder=" "
              required
              aria-label="Email"
              autoComplete="email"
            />
            <label htmlFor="email">Email</label>
          </div>

          <div className="form-group">
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder=" "
                required
                aria-label="Password"
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder=" "
                  required
                  aria-label="Confirm password"
                  autoComplete="new-password"
                />
                <label htmlFor="confirmPassword">Confirm Password</label>
              </div>
            </div>
          )}

          {isLogin && (
            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="forgot-password">
                Forgot password?
              </Link>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading
              ? isLogin
                ? "Signing in..."
                : "Creating Account..."
              : isLogin
                ? "Sign In"
                : "Create Account"}
          </button>

          <p className="switch-auth">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Link to={isLogin ? "/auth/signup" : "/auth/login"}>
              {isLogin ? "Sign Up" : "Sign in"}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Auth;