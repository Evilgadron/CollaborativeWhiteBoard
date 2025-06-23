```
### SyncBoard: Real-time Collaborative Whiteboard

![SyncBoard in Action](link-to-your-actual-screenshot-or-gif.gif)
SyncBoard is a dynamic and intuitive real-time collaborative whiteboard application designed for seamless online collaboration. Whether you're brainstorming ideas, teaching remotely, or just doodling with friends, SyncBoard provides a smooth, interactive canvas where multiple users can draw, chat, and interact simultaneously.

## ✨ Features

* **Real-time Drawing:** Experience instant updates as users draw on the shared canvas.

* **Multiple Drawing Tools:** Support for various tools (pen, eraser, shapes, text).

* **Live Chat:** Communicate with other session participants through an integrated chat system.

* **Public Sessions:** Easily create and share public sessions where anyone with the link can join and contribute.

* **Private Sessions (Owner Controls):** For more controlled environments, create private sessions where:

  * The session owner manages drawing permissions for individual participants.

  * The owner can grant or revoke drawing access to any participant.

  * Pending join requests are displayed and can be approved or rejected by the owner.

  * The owner can grant or revoke all drawing access at once.

* **Responsive Design:** Optimized for a smooth experience across various devices (desktops, tablets, and mobile phones).

* **Dark Mode Support:** A user-friendly interface that adapts to the system's preferred color scheme.

* **User Authentication:** Secure user management to identify participants.

* **Persistent Whiteboard State:** Whiteboard drawings and chat messages persist within the session for the duration it's active.

## 🚀 Tech Stack

SyncBoard is built using a modern and robust technology stack:

* **Frontend:**

  * [React](https://reactjs.org/) - A JavaScript library for building dynamic and responsive user interfaces, enabling interactive and efficient whiteboard rendering.

  * **Pure CSS** - For styling components, ensuring full control and no external framework dependencies like Tailwind CSS.

  * [React Router DOM](https://reactrouter.com/web/guides/quick-start) - For client-side routing.

  * [Socket.IO Client](https://socket.io/docs/v4/client-api/) - For real-time, bidirectional event-based communication.

  * [Font Awesome](https://fontawesome.com/) - For vector icons.

* **Backend:**

  * [Node.js](https://nodejs.js.org/) - A JavaScript runtime environment that powers the scalable and real-time backend services for SyncBoard.

  * [Express.js](https://expressjs.com/) - A fast, minimalist web framework for Node.js, used to build the robust API and manage session logic.

  * [Socket.IO](https://socket.io/) - For real-time server-side communication.

  * [MongoDB](https://www.mongodb.com/) - NoSQL database for storing session data, whiteboard strokes, and chat messages.

* **Authentication:**

  * Custom authentication system.

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your system:

* [Node.js](https://nodejs.org/en/download/) (LTS version recommended)

* [npm](https://www.npmjs.com/get-npm) (comes with Node.js) or [Yarn](https://classic.yarnpkg.com/en/docs/install/)

* [Git](https://git-scm.downloads)

* [MongoDB Community Server](https://www.mongodb.com/try/download/community) (for local development) or access to a cloud-based MongoDB service like MongoDB Atlas (recommended for ease of setup).

## ⚙️ Installation

Follow these steps to set up and run SyncBoard on your local machine:

### 1. Clone the Repository

```

git clone \<repository\_url\_here\>
cd syncboard-project \# Replace with your project's root folder name

```

### 2. Backend Setup

Navigate into the `server` directory (or wherever your backend code resides) and install dependencies.

```

cd server \# or cd backend
npm install \# or yarn install

```

#### Environment Variables

Create a `.env` file in your `server` directory with the following variables:

```

PORT=5000
MONGODB\_URI=\<Your MongoDB Connection String\>
JWT\_SECRET=\<A\_Strong\_Random\_Secret\_Key\_for\_Auth\>

```

* Replace `<Your MongoDB Connection String>` with your MongoDB connection string (e.g., from MongoDB Atlas or your local MongoDB instance).

* Generate a strong random string for `JWT_SECRET`. You can use a tool like `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Frontend Setup

Navigate into the `client` directory (or wherever your frontend React code resides) and install dependencies.

```

cd ../client \# or cd frontend
npm install \# or yarn install

```

#### Environment Variables

Create a `.env` file in your `client` directory (at the root of the React app) with the following variable:

```

REACT\_APP\_API\_URL=http://localhost:5000 \# Matches your backend PORT

```

### 4. Install Font Awesome (Important for Icons)

If you haven't already, install the Font Awesome React components and SVG icons:

```

npm install @fortawesome/react-fontawesome @fortawesome/free-solid-svg-icons

# OR

yarn add @fortawesome/react-fontawesome @fortawesome/free-solid-svg-icons

```

## ▶️ Running the Application

Once both the backend and frontend dependencies are installed, you can start the application:

### 1. Start the Backend Server

In your `server` directory:

```

npm start \# or node server.js (depending on your start script)

```

The server will typically start on `http://localhost:5000`.

### 2. Start the Frontend Application

In your `client` directory:

```

npm start

```

This will open the SyncBoard application in your default web browser at `http://localhost:3000` (or another available port).

## 💡 Usage

### Authentication

* Navigate to the application URL (e.g., `http://localhost:3000`).

* Register a new account or log in with existing credentials.

### Creating/Joining Sessions

* From the home dashboard, you can create a new session (public or private).

* To join an existing session, you'll need the Session ID. For private sessions, you might also need a session key or owner approval.

### Whiteboard Interaction

* **Drawing:** Select your desired tool (pen, eraser, shape, text), color, and size from the toolbar (if applicable in your `Whiteboard.js`).

* **Real-time Collaboration:** Watch as other participants' drawings appear instantly on your canvas.

### Chat

* Use the integrated chat panel to communicate with other users in the session.

### Private Session Owner Controls

*(Only applicable if you are the session owner)*

* **Grant/Revoke Individual Drawing Permissions:** In the participants panel, click the pencil/ban icon next to a participant's name to toggle their drawing access.

* **Grant All/Revoke All Drawing Access:** Use the dedicated buttons in the owner controls section to manage drawing permissions for all non-owner participants.

## 📂 Project Structure

A high-level overview of the project directory:

```

syncboard-project/
├── client/                 \# Frontend React application
│   ├── public/             \# Public assets
│   ├── src/                \# React source code
│   │   ├── components/     \# Reusable UI components (e.g., Whiteboard.js)
│   │   ├── context/        \# React Context for authentication (AuthContext.js)
│   │   ├── pages/          \# Main application pages (e.g., SessionPublic.js, Session.js, Home.js)
│   │   └── App.js          \# Main application component
│   │   └── SessionPublic.css \# Public session specific styles (if used)
│   │   └── Session.css     \# Private session specific styles
│   └── package.json
├── server/                 \# Backend Node.js/Express application
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── .env.example
│   ├── server.js           \# Main server entry point
│   └── package.json
├── .gitignore              \# Specifies intentionally untracked files to ignore
├── README.md               \# This file
└── package.json            \# Project-level dependencies (if using monorepo setup)

```

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please follow these steps:

1.  **Fork** the repository.

2.  **Clone** your forked repository: `git clone <your_fork_url>`

3.  **Create a new branch:** `git checkout -b feature/your-feature-name`

4.  **Make your changes.**

5.  **Commit your changes:** `git commit -m 'feat: Add new awesome feature'` (Please use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.)

6.  **Push to the branch:** `git push origin feature/your-feature-name`

7.  **Open a Pull Request** to the `main` branch of the original repository.

Please ensure your code adheres to the project's coding style and includes relevant tests.

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.

## 📞 Contact

If you have any questions or feedback, feel free to reach out:

* **Your Name/Email/LinkedIn:** [Optional, but good for open-source projects]

---

**Happy Collaborating with SyncBoard!**
```
