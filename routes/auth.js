/**
 * Authentication Routes Module
 * 
 * Handles user authentication operations including registration, login, logout,
 * and supporting functions like country data retrieval for registration forms.
 * Implements security best practices with password hashing and session management.
 * 
 * Features:
 * - User registration with validation and password hashing
 * - Secure login with credential verification
 * - Session-based authentication management
 * - Country data caching for registration forms
 * - Application information endpoints
 */

var express = require("express");
var router = express.Router();
const MySql = require("../routes/utils/MySql");
const DButils = require("../routes/utils/DButils");
const bcrypt = require("bcrypt");
const axios = require("axios");

// Configuration for country filtering
const EXCLUDE = ["Palestine", "Iran"];

// Country data caching configuration
let cachedCountries = { list: [], fetchedAt: 0 };
const COUNTRIES_TTL = 24 * 60 * 60 * 1000; // 24 hours cache duration

/**
 * Retrieves and caches country data from REST Countries API
 * Implements caching strategy to reduce API calls and improve performance
 * @returns {Promise<string[]>} Sorted array of country names (filtered)
 * @throws {Error} API request failures or data processing errors
 */
async function getCountries() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedCountries.list.length && now - cachedCountries.fetchedAt < COUNTRIES_TTL) {
    return cachedCountries.list;
  }

  // Fetch fresh country data from external API
  const res = await axios.get("https://restcountries.com/v3.1/all?fields=name");
  cachedCountries.list = res.data
    .map(c => c.name.common)
    .filter(name => !EXCLUDE.includes(name))  // Remove excluded countries
    .sort((a, b) => a.localeCompare(b));      // Alphabetical sorting

  cachedCountries.fetchedAt = now;
  return cachedCountries.list;
}

/**
 * GET /countries
 * Provides list of countries for registration form dropdowns
 * Returns cached data when available to improve response time
 */
router.get("/countries", async (req, res, next) => {
    try {
        res.json(await getCountries());
    } catch (err) {
        next(err);
    }
});

router.post("/Register", async (req, res, next) => {
  try {
    let user_details = {
      username: req.body.username,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      country: req.body.country,
      password: req.body.password,
      email: req.body.email
    };

    // Input validation
    if (
      typeof user_details.username !== "string" ||
      typeof user_details.firstname !== "string" ||
      typeof user_details.lastname !== "string" ||
      typeof user_details.country !== "string" ||
      typeof user_details.password !== "string" ||
      typeof user_details.email !== "string" ||
      !user_details.username.trim() ||
      !user_details.firstname.trim() ||
      !user_details.lastname.trim() ||
      !user_details.country.trim() ||
      !user_details.password.trim() ||
      !user_details.email.trim()
    ) {
      throw { status: 400, message: "All fields are required and must be non-empty strings." };
    }

    // Username: 3-8 letters, only alphabetic
    if (!/^[A-Za-z]{3,8}$/.test(user_details.username)) {
      throw { status: 400, message: "Username must be 3-8 letters only." };
    }

    // Password: 5-10 chars, at least one digit and one special char
    if (
      !/^.{5,10}$/.test(user_details.password) ||
      !/\d/.test(user_details.password) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(user_details.password)
    ) {
      throw {
        status: 400,
        message:
          "Password must be 5-10 characters, include at least one digit and one special character."
      };
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_details.email)) {
      throw { status: 400, message: "Invalid email format." };
    }

      // Validate country using REST Countries API
    const countries = await getCountries();
    if (!countries.includes(user_details.country)) {
      throw { status: 400, message: "Invalid country." };
    }

    // Unique username check
    let users = await DButils.execQuery("SELECT username from users");
    if (users.find((x) => x.username === user_details.username))
      throw { status: 409, message: "Username taken" };

    // Hash password
    let hash_password = bcrypt.hashSync(
      user_details.password,
      parseInt(process.env.bcrypt_saltRounds)
    );

    await DButils.execQuery(
      `INSERT INTO users (username, firstname, lastname, country, password, email) VALUES ('${user_details.username}', '${user_details.firstname}', '${user_details.lastname}',
      '${user_details.country}', '${hash_password}', '${user_details.email}')`
    );
    res.status(201).send({ message: "user created, please login", success: true, redirect: "/Login" });
  } catch (error) {
    next(error);
  }
});

router.post("/Login", async (req, res, next) => {
  try {
    // Input validation
    if (
      typeof req.body.username !== "string" ||
      typeof req.body.password !== "string" ||
      !req.body.username.trim() ||
      !req.body.password.trim()
    ) {
      throw { status: 400, message: "Invalid username or password" };
    }

    // check that username exists
    const users = await DButils.execQuery("SELECT username FROM users");
    if (!users.find((x) => x.username === req.body.username))
      throw { status: 401, message: "Invalid username or password" };

    // check that the password is correct
    const user = (
      await DButils.execQuery(
        `SELECT * FROM users WHERE username = '${req.body.username}'`
      )
    )[0];

    if (!bcrypt.compareSync(req.body.password, user.password)) {
      throw { status: 401, message: "Invalid username or password" };
    }

    req.session.user_id = user.user_id;
    console.log("session user_id login: " + req.session.user_id);

    res.status(200).send({ message: "login succeeded " , success: true , redirect: "/recipes"});
  } catch (error) {
    next(error);
  }
});

router.post("/Logout", function (req, res) {
  console.log("session user_id Logout: " + req.session.user_id);
  req.session.reset(); // reset the session info --> send cookie when  req.session == undefined!!
  res.send({ success: true, message: "logout succeeded" , redirect: "/recipes"});
});

/**
 * GET /about
 * Returns information about the Family Recipe project and developers.
 */
router.get("/about", (req, res) => {
  res.json({
    summary: "This project is all about family. Allowing you to store your traditional family recipes, be rest assured that with us your family would enjoy traditional meals for generations! Developed by a dedicated student team from Ben-Gurion University.",
    team: [
      {
        name: "Shahaf Har-Tsvi",
        role: "Developer",
        contact: "hartsvis@bgu.ac.il"
      },
      {
        name: "Shahar Navian",
        role: "Developer",
        contact: "navians@post.bgu.ac.il"
      }
    ],
    previousProjects: [
      {
        title: "Space Invaders",
        url: "https://wed-2023.github.io/assignment2-325895332_326307246_assignment2/"
      },
      {
        title: "Varda's personal site",
        url: "https://wed-2023.github.io/assignment1-326307246/"
      },
      {
        title: "Trevor's personal site",
        url: "https://wed-2023.github.io/325895332/"
      }
    ]
  });
});

module.exports = router;
