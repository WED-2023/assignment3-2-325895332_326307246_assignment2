const DButils = require("./DButils");

async function markAsFavorite(user_id, recipe_id){
    await DButils.execQuery(`insert into FavoriteRecipes values ('${user_id}',${recipe_id})`);
}

async function getFavoriteRecipes(user_id){
    const recipes_id = await DButils.execQuery(`select recipe_id from FavoriteRecipes where user_id='${user_id}'`);
    return recipes_id;
}

async function getLastWatchedRecipes(user_id) {
  const recipes = await DButils.execQuery(
    `SELECT recipe_id FROM LastWatchedRecipes WHERE user_id='${user_id}'`
  );
  return recipes;
}

exports.getLastWatchedRecipes = getLastWatchedRecipes;
exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
