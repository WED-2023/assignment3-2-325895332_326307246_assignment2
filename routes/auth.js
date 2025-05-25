var express = require("express");
var router = express.Router();
const MySql = require("../routes/utils/MySql");
const DButils = require("../routes/utils/DButils");
const bcrypt = require("bcrypt");
const axios = require("axios");

router.post("/Register", async (req, res, next) => {
  try {
    let user_details = {
      username: req.body.username,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      country: req.body.country,
      password: req.body.password,
      email: req.body.email,
      profilePic: req.body.profilePic
    };

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

    // Validate country using REST Countries API
    const countriesResponse = await axios.get("https://restcountries.com/v3.1/all");
    const countries = countriesResponse.data.map(c => c.name.common);
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
      `INSERT INTO users (username, firstname, lastname, country, password, email, profilePic) VALUES ('${user_details.username}', '${user_details.firstname}', '${user_details.lastname}',
      '${user_details.country}', '${hash_password}', '${user_details.email}', '${user_details.profilePic}')`
    );
    // Success: tell frontend to redirect to login
    res.status(201).send({ message: "user created, please login", success: true, redirect: "/login" });
  } catch (error) {
    next(error);
  }
});

router.post("/Login", async (req, res, next) => {
  try {
    // check that username exists
    const users = await DButils.execQuery("SELECT username FROM users");
    if (!users.find((x) => x.username === req.body.username))
      throw { status: 401, message: "Username or Password incorrect" };

    // check that the password is correct
    const user = (
      await DButils.execQuery(
        `SELECT * FROM users WHERE username = '${req.body.username}'`
      )
    )[0];

    if (!bcrypt.compareSync(req.body.password, user.password)) {
      throw { status: 401, message: "Username or Password incorrect" };
    }

    // Set cookie
    req.session.user_id = user.user_id;
    console.log("session user_id login: " + req.session.user_id);

    // return cookie
    res.status(200).send({ message: "login succeeded " , success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/Logout", function (req, res) {
  console.log("session user_id Logout: " + req.session.user_id);
  req.session.reset(); // reset the session info --> send cookie when  req.session == undefined!!
  res.send({ success: true, message: "logout succeeded" });
});

module.exports = router;