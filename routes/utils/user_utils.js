const DButils = require("./DButils");


/**
 * Marks a recipe as favorite for a user.
 * @param {string|number} user_id - The user's ID.
 * @param {string|number} recipe_id - The recipe's ID.
 * @param {boolean} [isSpoonacular=true] - Whether the recipe is from Spoonacular.
 * @throws {object} If recipe_id is invalid or isSpoonacular is not boolean.
 */
async function markAsFavorite(user_id, recipe_id, isSpoonacular = true) {
  // Validate input
  if (
    user_id === undefined || user_id === null || user_id === "" ||
    recipe_id === undefined || recipe_id === null || recipe_id === "" ||
    typeof isSpoonacular !== "boolean"
  ) {
    throw { status: 400, message: "Invalid input for marking favorite" };
  }
  // Insert or update favorite recipe
  await DButils.execQuery(`
    INSERT INTO FavoriteRecipes (user_id, recipe_id, isSpoonacular)
    VALUES ('${user_id}', '${recipe_id}', ${isSpoonacular ? 1 : 0})
    ON DUPLICATE KEY UPDATE created_at = created_at
  `);
}

/**
 * Retrieves all favorite recipes for a user.
 * @param {string|number} user_id - The user's ID.
 * @returns {Promise<Array<{recipe_id: string, isSpoonacular: boolean}>>}
 */
async function getFavoriteRecipes(user_id) {
  if (user_id === undefined || user_id === null || user_id === "") {
    throw { status: 400, message: "Invalid user_id" };
  }
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, isSpoonacular
      FROM FavoriteRecipes
     WHERE user_id='${user_id}'
  `);
  return recipes;
}

/**
 * Marks a recipe as watched for a user.
 * @param {string|number} user_id - The user's ID.
 * @param {string|number} recipe_id - The recipe's ID.
 * @param {boolean} [isSpoonacular=true] - Whether the recipe is from Spoonacular.
 */
async function markAsWatched(user_id, recipe_id, isSpoonacular = true) {
  // Validate input
  if (
    user_id === undefined || user_id === null || user_id === "" ||
    recipe_id === undefined || recipe_id === null || recipe_id === "" ||
    typeof isSpoonacular !== "boolean"
  ) {
    throw { status: 400, message: "Invalid input for marking watched" };
  }
  // Insert or update last watched recipe
  await DButils.execQuery(`
    INSERT INTO LastWatchedRecipes (user_id, recipe_id, isSpoonacular)
    VALUES ('${user_id}', '${recipe_id}', ${isSpoonacular ? 1 : 0})
    ON DUPLICATE KEY
      UPDATE watched_at = NOW()
  `);
}

/**
 * Retrieves the last watched recipes for a user, optionally filtered by source.
 * @param {string|number} user_id - The user's ID.
 * @param {number} [limit] - Maximum number of records to return.
 * @param {boolean} [isSpoonacular] - Filter by Spoonacular source.
 * @returns {Promise<Array<{recipe_id: string, isSpoonacular: boolean}>>}
 */
async function getLastWatchedRecipes(user_id, limit, isSpoonacular) {
  if (user_id === undefined || user_id === null || user_id === "") {
    throw { status: 400, message: "Invalid user_id" };
  }
  if (limit !== undefined && (typeof limit !== "number" || limit <= 0)) {
    throw { status: 400, message: "Limit must be a positive number" };
  }
  if (isSpoonacular !== undefined && typeof isSpoonacular !== "boolean") {
    throw { status: 400, message: "isSpoonacular must be boolean" };
  }
  let query = `
    SELECT recipe_id, isSpoonacular
      FROM LastWatchedRecipes
     WHERE user_id='${user_id}'`;
  if (typeof isSpoonacular === "boolean") {
    query += ` AND isSpoonacular=${isSpoonacular ? 1 : 0}`;
  }
  query += " ORDER BY watched_at DESC";
  if (limit) query += ` LIMIT ${limit}`;
  return DButils.execQuery(query);
};

module.exports = {
  markAsFavorite,
  getFavoriteRecipes,
  markAsWatched,
  getLastWatchedRecipes
};
