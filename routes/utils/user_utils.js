const DButils = require("./DButils");



async function markAsFavorite(user_id, recipe_id, isSpoonacular = true) {
  if (typeof isSpoonacular !== "boolean") {
    throw new Error("isSpoonacular flag must be boolean (true/false)");
  }
  await DButils.execQuery(`
    INSERT INTO FavoriteRecipes (user_id, recipe_id, isSpoonacular)
    VALUES ('${user_id}', '${recipe_id}', ${isSpoonacular ? 1 : 0})
    ON DUPLICATE KEY UPDATE created_at = created_at
  `);
}

/**
 * מחזיר את המתכונים המועדפים
 * @param {string} user_id
 * @returns {Promise<Array<{recipe_id: string, isSpoonacular: boolean}>>}
 */
async function getFavoriteRecipes(user_id) {
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, isSpoonacular
      FROM FavoriteRecipes
     WHERE user_id='${user_id}'
  `);
  return recipes;
}

/**
 * רושם צפייה בטבלת LastWatchedRecipes
 * עם עדכון watched_at על כפילות
 * @param {string} user_id
 * @param {string|number} recipe_id
 * @param {boolean} [isSpoonacular=true]
 */
async function markAsWatched(user_id, recipe_id, isSpoonacular = true) {
  await DButils.execQuery(`
    INSERT INTO LastWatchedRecipes (user_id, recipe_id, isSpoonacular)
    VALUES ('${user_id}', '${recipe_id}', ${isSpoonacular ? 1 : 0})
    ON DUPLICATE KEY
      UPDATE watched_at = NOW()
  `);
}

/**
 * מחזיר את הצפיות האחרונות (מסוננות אופציונלית לפי isSpoonacular).
 * @param {string}  user_id
 * @param {number}  limit            – מספר מקס’ רשומות (אופציונלי)
 * @param {boolean} [isSpoonacular]  – אם לא נשלח ⇒ ללא סינון
 */
async function getLastWatchedRecipes(user_id, limit, isSpoonacular) {
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
