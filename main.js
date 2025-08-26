/**
 * Vue Recipes Backend Application
 * 
 * Main entry point for the Express.js backend server that powers the Vue Recipes application.
 * Provides RESTful API endpoints for recipe management, user authentication, and data persistence.
 * 
 * Features:
 * - Express.js web framework with middleware stack
 * - Session-based authentication with client-sessions
 * - Database initialization and connection management
 * - Static file serving for frontend application
 * - Request logging and JSON parsing
 * - Route organization with modular structure
 * - CORS support for cross-origin requests
 */

require("dotenv").config();

// Core Express and middleware imports
var express = require("express");
var path = require("path");
var logger = require("morgan");
const session = require("client-sessions");
const DButils = require("./routes/utils/DButils");
var cors = require('cors')

// Initialize database schema before starting server
DButils.createTablesIfNotExist()
  .then(() => console.log("Database tables checked/created."))
  .catch(err => {
    console.error("Failed to create tables:", err);
    process.exit(1);
  });

var app = express();

// HTTP request logging for development and debugging
app.use(logger("dev"));

// JSON request body parsing middleware
app.use(express.json());

// Session management configuration
app.use(
  session({
    cookieName: "session",              // Session cookie name
    secret: "template",                 // Session encryption secret
    duration: 24 * 60 * 60 * 1000,      // 24 hours session duration
    activeDuration: 1000 * 60 * 5,      // 5 minutes activity extension
    cookie: {
      httpOnly: false,                  // Allow client-side access for SPA
    }
  })
);

// URL-encoded form data parsing middleware
app.use(express.urlencoded({ extended: false }));

// Serve static files from 'public' and 'dist' directories
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "../assignment-3-3-frontend/dist")));

// Serve the main HTML file for the root path
app.get("/", function(req, res) {
  res.sendFile(__dirname + "../assignment-3-3-frontend/dist/index.html");
});

// Uncomment below to enable CORS if needed
// app.use(cors());
// app.options("*", cors());

// Uncomment and adjust for custom CORS configuration
const corsConfig = { origin: true, credentials: true };
app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

// Set server port (default 3000 for local, 80 for remote)
var port = process.env.PORT || "3000";

// Import route modules
const user = require("./routes/user");
const recipes = require("./routes/recipes");
const auth = require("./routes/auth");
const { builtinModules } = require("module");

// Middleware to attach user_id to request if session is valid
app.use(function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users")
      .then((users) => {
        if (users.find((x) => x.user_id === req.session.user_id)) {
          req.user_id = req.session.user_id;
        }
        next();
      })
      .catch((error) => next());
  } else {
    next();
  }
});

// Health check endpoint
app.get("/alive", (req, res) => res.send("I'm alive"));

// Register route handlers
app.use("/users", user);
app.use("/recipes", recipes);
app.use("/", auth);

// Error handler for all routes
app.use(function (err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).send({ message: err.message, success: false });
});

// // Start the server
// const server = app.listen(port, () => {
//   console.log(`Server listen on port ${port}`);
// });
// 
// // Graceful shutdown on SIGINT
// process.on("SIGINT", function () {
//   if (server) {
//     server.close(() => console.log("server closed"));
//   }
//   process.exit();
// });
module.exports = app;