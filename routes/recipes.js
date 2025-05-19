var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");
const user_utils = require("./utils/user_utils");


/**
 * This path returns a full details of a recipe by its id
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;
    const recipe = await recipes_utils.getRecipeDetails(recipeId);

    if (req.session && req.session.user_id) {
      const user_id = req.session.user_id;

      const favorites = await user_utils.getFavoriteRecipes(user_id);
      const watched = await user_utils.getLastWatchedRecipes(user_id);

      recipe.isFavorite = favorites.some(r => r.recipe_id == recipeId);
      recipe.isWatched = watched.some(r => r.recipe_id == recipeId);
    }

    res.status(200).send(recipe);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
