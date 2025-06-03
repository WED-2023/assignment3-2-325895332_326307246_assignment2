require("dotenv").config();
const MySql = require("./MySql");

/**
 * Executes a SQL query within a transaction.
 * @param {string} query - The SQL query to execute.
 * @returns {Promise<any>} - The result of the query.
 * @throws {Error} If the query fails.
 */
exports.execQuery = async function (query) {
    let returnValue = []
    const connection = await MySql.connection();
    try {
    await connection.query("START TRANSACTION");
    returnValue = await connection.query(query);
  } catch (err) {
    await connection.query("ROLLBACK");
    throw err;
  } finally {
    await connection.release();
  }
  return returnValue
}

/**
 * Creates all required database tables if they do not exist.
 * Uses a transaction to ensure atomicity.
 * @returns {Promise<void>}
 * @throws {Error} If table creation fails.
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
        profilePic VARCHAR(255),
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