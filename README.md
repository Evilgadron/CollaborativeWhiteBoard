
# 🧩 SyncBoard: Real-Time Collaborative Whiteboard

**SyncBoard** is a dynamic, real-time collaborative whiteboard application built for seamless online teamwork. Whether you’re brainstorming, teaching remotely, or doodling with friends, SyncBoard provides an interactive canvas where multiple users can draw, chat, and collaborate — live.

---

## ✨ Features

* 🎨 **Real-Time Drawing**
  Instant updates as users draw on the shared canvas.

* ✏️ **Multiple Drawing Tools**
  Includes pen, eraser, shapes, text, and color/size selection.

* 💬 **Integrated Live Chat**
  Communicate with other participants during your session.

* 🌐 **Public Sessions**
  Easily create and share links for anyone to join and collaborate.

* 🔐 **Private Sessions with Owner Controls**

  * Manage individual drawing permissions.
  * Grant/Revoke all access in one click.

* 📱 **Responsive Design**
  Works smoothly on desktops, tablets, and mobile phones.

* 🔐 **User Authentication**
  Secure login and identity management for all users.

* 💾 **Persistent Sessions**
  Whiteboard and chat history remain intact while sessions are active.

---

## 🛠️ Tech Stack

### 🔧 Frontend

* [React](https://reactjs.org/) – UI Library
* [React Router DOM](https://reactrouter.com/) – Routing
* [Socket.IO Client](https://socket.io/docs/v4/client-api/) – Real-time communication
* Pure CSS – Styling with full control (no Tailwind or frameworks)
* [Font Awesome](https://fontawesome.com/) – Icon support

### ⚙️ Backend

* [Node.js](https://nodejs.org/) – Runtime
* [Express.js](https://expressjs.com/) – Web framework
* [Socket.IO](https://socket.io/) – Real-time communication
* [MongoDB](https://www.mongodb.com/) – NoSQL Database

### 🔐 Authentication

* Custom JWT-based authentication system

---

## 📦 Prerequisites

Ensure the following are installed:

* [Node.js](https://nodejs.org/en/download/) (LTS recommended)
* [npm](https://www.npmjs.com/get-npm) or [Yarn](https://classic.yarnpkg.com/en/docs/install/)
* [Git](https://git-scm.com/downloads)
* [MongoDB](https://www.mongodb.com/try/download/community) (Local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) for cloud)

---

## ⚙️ Installation

### 1. Clone the Repository

```bash
git clone <repository_url_here>
cd syncboard-project
```

---

### 2. Backend Setup

```bash
cd server
npm install
```

#### Create a `.env` file:

```env
PORT=5000
MONGODB_URI=<your_mongo_uri>
JWT_SECRET=<your_random_jwt_secret>
```

To generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 3. Frontend Setup

```bash
cd ../client
npm install
```

#### Create a `.env` file:

```env
REACT_APP_API_URL=http://localhost:5000
```

---

### 4. Install Font Awesome (for icons)

```bash
npm install @fortawesome/react-fontawesome @fortawesome/free-solid-svg-icons
```

---

## ▶️ Running the App

### 1. Start Backend

```bash
cd server
npm start
```

* Typically runs at: [http://localhost:5000](http://localhost:5000)

### 2. Start Frontend

```bash
cd ../client
npm start
```

* Opens at: [http://localhost:3000](http://localhost:3000)

---

## 💡 Usage Guide

### 🔑 Authentication

* Navigate to [http://localhost:3000](http://localhost:3000)
* Register or log in to get started

### 🎨 Create or Join Sessions

* **Create New Session**: Choose public or private
* **Join Session**: Enter the session ID (and key, if private)

### 🖌️ Drawing on the Whiteboard

* Choose a tool from the toolbar (pen, eraser, shapes, text)
* Select color and size
* All drawings appear in real-time to all participants

### 💬 Chat Panel

* Use the integrated chat to message all session participants

### 👑 Owner Controls (Private Sessions)

* **Grant/Revoke** drawing access per participant
* **Can clear board** only owner can clear board.
* **Manage All** access with one click

---

## 📁 Project Structure

```
syncboard-project/
├── client/              # React Frontend
│   ├── public/
│   └── src/
│       ├── components/  # UI Components (e.g., Whiteboard.js)
│       ├── context/     # Auth Context
│       ├── pages/       # Page Views
│       └── App.js
├── server/              # Node.js Backend
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── server.js
├── .gitignore
├── README.md
└── package.json         # (For monorepo, if used)
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Clone your fork:

   ```bash
   git clone <your_fork_url>
   ```
3. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Make your changes and commit:

   ```bash
   git commit -m "feat: Add awesome feature"
   ```
5. Push and open a Pull Request:

   ```bash
   git push origin feature/your-feature-name
   ```

✅ Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for better commit history.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

## 📞 Contact

> *Feel free to reach out with questions or feedback!*


