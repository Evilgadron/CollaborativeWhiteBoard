import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Keeping the original context path from your code
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-solid-svg-icons'; // Removed faLock, faUnlockAlt
import './Home.css'; // Assuming you have a CSS file for styling

// API_URL is not directly used here, so it can be removed or commented out if not used elsewhere
// const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Home component for user authentication and session management.
 * Allows users to create new public/private sessions or join existing ones.
 */
function Home() {
    const navigate = useNavigate();
    const { user, logout } = useAuth(); // Get user and logout function from AuthContext

    // State for controlling modal visibility
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false); // Corrected: Removed duplicate declaration

    // State for joining an existing session
    const [sessionIdToJoin, setSessionIdToJoin] = useState('');
    const [sessionKeyToJoin, setSessionKeyToJoin] = useState(''); // For joining private sessions
    const [joinError, setJoinError] = useState(''); // To display errors during join attempts

    // State for creating a new session
    const [sessionName, setSessionName] = useState('');
    const [isPrivateCreation, setIsPrivateCreation] = useState(false); // To toggle between public/private creation
    const [generatedSessionKey, setGeneratedSessionKey] = useState(''); // To store the generated key for private sessions
    const [showCopyMessage, setShowCopyMessage] = useState(false); // For copy feedback on the generated key

    /**
     * Generates a random alphanumeric session ID (6 characters).
     * @returns {string} The generated session ID.
     */
    const generateSessionId = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    /**
     * Generates a random alphanumeric session key (8 characters) for private sessions.
     * @returns {string} The generated session key.
     */
    const generateSessionKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    /**
     * Handles the creation of a new session (public or private).
     * Constructs the navigation path with session details and privacy settings.
     * @param {Event} e - The form submission event.
     */
    const handleCreateSession = (e) => {
        e.preventDefault();
        if (sessionName.trim()) {
            const newSessionId = generateSessionId();
            let navigationPath;

            if (isPrivateCreation) {
                // If creating a private session, use the original /session route
                const key = generatedSessionKey || generateSessionKey(); // Ensure a key is used/generated
                navigationPath = `/session/${newSessionId}?name=${encodeURIComponent(sessionName.trim())}&private=true&key=${key}`;
                // Set the generated key in state for display and copy
                setGeneratedSessionKey(key);
            } else {
                // If creating a public session, use the new /public-session route
                navigationPath = `/public-session/${newSessionId}?name=${encodeURIComponent(sessionName.trim())}&public=true`;
            }

            // Navigate to the new session
            navigate(navigationPath);
        }
    };

    /**
     * Handles joining an existing session.
     * Constructs the navigation path with session ID and optional session key.
     * @param {Event} e - The form submission event.
     */
    const handleJoinSession = (e) => {
        e.preventDefault();
        if (sessionIdToJoin.trim()) {
            let navigationPath = `/session/${sessionIdToJoin.trim()}`;
            // If a session key is provided, append it to the URL
            if (sessionKeyToJoin.trim()) {
                navigationPath += `?key=${sessionKeyToJoin.trim()}`;
            }
            // Session.js component will handle the actual socket join logic based on these URL parameters
            navigate(navigationPath);
        } else {
            setJoinError("Please enter a Session ID.");
        }
    };

    /**
     * Handles user logout.
     * Calls the logout function from AuthContext and redirects to the login page.
     */
    const handleLogout = () => {
        logout();
        navigate('/auth/login');
    };

    // Removed handleTogglePrivate as it was unused and replaced by direct button actions

    /**
     * Copies the generated session key to the clipboard.
     * Provides visual feedback to the user.
     */
    const copySessionKeyToClipboard = () => {
        const tempInput = document.createElement('textarea');
        tempInput.value = generatedSessionKey;
        document.body.appendChild(tempInput); // Temporarily add to DOM to make it selectable
        tempInput.select();
        try {
            document.execCommand('copy'); // Execute copy command
            setShowCopyMessage(true); // Show "Copied!" message
            setTimeout(() => setShowCopyMessage(false), 1000); // Hide after 1 second
        } catch (err) {
            console.error("Failed to copy text: ", err);
            // Fallback for browsers that don't support execCommand in some contexts
            prompt("Copy this key manually:", generatedSessionKey);
        } finally {
            document.body.removeChild(tempInput); // Clean up the temporary element
        }
    };

    return (
        <div className="home-page">
            {user && (
                <div className="greeting-message">
                    Hey {user.name}, ready to Draw/Write in sync?
                </div>
            )}
            <div className="logout-button">
                <button onClick={handleLogout} className="btn btn-secondary">
                    Logout
                </button>
            </div>

            <div className="content-container">
                <div className="header-section">
                    <h1 className="title">SyncBoard</h1>
                </div>

                <div className="actions-section">
                    {/* Buttons to choose session type upon creation */}
                    <button onClick={() => {
                        setShowCreateModal(true);
                        setIsPrivateCreation(false); // Default to public
                        setGeneratedSessionKey(''); // Ensure no key is displayed initially for public
                        setSessionName(''); // Clear previous session name
                    }} className="btn btn-primary create-public-btn">
                        Create Public Session
                    </button>
                    <button onClick={() => {
                        setShowCreateModal(true);
                        setIsPrivateCreation(true); // Default to private
                        setGeneratedSessionKey(generateSessionKey()); // Generate key immediately for private
                        setSessionName(''); // Clear previous session name
                    }} className="btn btn-primary create-private-btn">
                        Create Private Session
                    </button>
                    {/* Existing Join Session button */}
                    <button onClick={() => {
                        setShowJoinModal(true);
                        setSessionIdToJoin(''); // Clear previous session ID
                        setSessionKeyToJoin(''); // Clear previous session key
                        setJoinError(''); // Clear previous error
                    }} className="btn btn-secondary">
                        Join Session
                    </button>
                </div>

                <footer className="footer">
                    SyncBoard © 2025 | Draw/Write Together
                </footer>
            </div>

            {/* Create Session Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Create New {isPrivateCreation ? 'Private' : 'Public'} Session</h3>
                            <button
                                className="close-modal-btn"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setGeneratedSessionKey(''); // Clear key on modal close
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleCreateSession}>
                            <div className="input-group">
                                <label htmlFor="session-name-input">Session Name</label>
                                <input
                                    id="session-name-input"
                                    type="text"
                                    placeholder="Enter Session Name"
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            {isPrivateCreation && generatedSessionKey && (
                                <div className="input-group mt-4 p-3 bg-gray-100 rounded-md flex items-center justify-between relative">
                                    <label className="font-medium mr-2">Session Key:</label>
                                    <span className="font-mono text-blue-700 select-all">{generatedSessionKey}</span>
                                    <button
                                        type="button"
                                        onClick={copySessionKeyToClipboard}
                                        className="ml-2 p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
                                        title="Copy Session Key"
                                    >
                                        <FontAwesomeIcon icon={faClipboard} />
                                        {showCopyMessage && (
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 animate-fade-in-out">
                                                Copied!
                                            </span>
                                        )}
                                    </button>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="submit" className="btn btn-primary">
                                    Create {isPrivateCreation ? 'Private' : 'Public'} Session
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Session Modal */}
            {showJoinModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Join Session</h3>
                            <button
                                className="close-modal-btn"
                                onClick={() => {
                                    setShowJoinModal(false);
                                    setJoinError('');
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleJoinSession}>
                            <div className="input-group">
                                <label htmlFor="session-id-input">Session ID</label>
                                <input
                                    id="session-id-input"
                                    type="text"
                                    placeholder="Enter Session ID"
                                    value={sessionIdToJoin}
                                    onChange={(e) => {
                                        setSessionIdToJoin(e.target.value);
                                        setJoinError(''); // Clear error on input
                                    }}
                                    required
                                    autoFocus
                                />
                            </div>
                            {/* Input for Session Key when joining */}
                            <div className="input-group mt-4">
                                <label htmlFor="session-key-input">Session Key (Optional for Private)</label>
                                <input
                                    id="session-key-input"
                                    type="text"
                                    placeholder="Enter Session Key (if private)"
                                    value={sessionKeyToJoin}
                                    onChange={(e) => setSessionKeyToJoin(e.target.value)}
                                />
                            </div>

                            {joinError && <div className="error-message">{joinError}</div>}

                            <div className="modal-actions">
                                <button type="submit" className="btn btn-primary">
                                    Join Session
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
