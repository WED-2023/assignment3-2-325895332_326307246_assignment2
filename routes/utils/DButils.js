/**
 * Database Utilities Module
 * 
 * This module provides essential database operation utilities for the application.
 * Handles transaction management, connection pooling, and database initialization.
 * 
 * Features:
 * - Safe query execution with transaction support
 * - Automatic rollback on errors
 * - Database schema initialization
 * - Connection management and cleanup
 */

require("dotenv").config();
const MySql = require("./MySql");

/**
 * Executes a SQL query within a transaction context for data safety
 * Automatically handles transaction lifecycle (begin, commit, rollback)
 * @param {string} query - The SQL query string to execute
 * @returns {Promise<any>} Query result data from the database
 * @throws {Error} Database error with automatic transaction rollback
 */
exports.execQuery = async function (query) {
    let returnValue = []
    const connection = await MySql.connection();
    try {
    // Begin transaction for data consistency
    await connection.query("START TRANSACTION");
    returnValue = await connection.query(query);
    // Implicit commit if no errors occur
  } catch (err) {
    // Rollback transaction on any error
    await connection.query("ROLLBACK");
    throw err;
  } finally {
    // Always release connection back to pool
    await connection.release();
  }
  return returnValue
}

/**
 * Initializes the database schema by creating all required tables
 * Ensures database structure exists before application operations
 * Uses transactions to maintain consistency during setup
 * @returns {Promise<void>}
 * @throws {Error} If table creation or setup fails
 */
exports.createTablesIfNotExist = async function () {
  const connection = await MySql.connection();
  try {
    await connection.query("START TRANSACTION");
    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        firstname VARCHAR(50),
        lastname VARCHAR(50),
        country VARCHAR(50),
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Recipes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Recipes (
        recipe_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255) NOT NULL,
        image VARCHAR(255),
        preparationTimeMinutes INT,
        isVegan BOOLEAN DEFAULT FALSE,
        isVegetarian BOOLEAN DEFAULT FALSE,
        isGlutenFree BOOLEAN DEFAULT FALSE,
        servings INT,
        instructions TEXT,
        isFamilyRecipe BOOLEAN DEFAULT FALSE,
        familyWho VARCHAR(255),
        familyWhen VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);
    // Ingredients table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Ingredients (
        ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
        recipe_id INT,
        name VARCHAR(255),
        quantity VARCHAR(100),
        FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id)
      )
    `);
    // FavoriteRecipes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS FavoriteRecipes (
        user_id INT,
        recipe_id VARCHAR(50),
        isSpoonacular BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, recipe_id, isSpoonacular),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);
    // LastWatchedRecipes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS LastWatchedRecipes (
        user_id INT,
        recipe_id VARCHAR(50),
        isSpoonacular BOOLEAN DEFAULT TRUE,
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, recipe_id, isSpoonacular),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);
    await connection.query("COMMIT");
  } catch (err) {
    await connection.query("ROLLBACK");
    throw err;
  } finally {
    await connection.release();
  }
};