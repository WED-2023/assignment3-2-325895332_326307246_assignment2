var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");
const user_utils = require("./utils/user_utils");


/**
 * This path returns a full details of a recipe by its id
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetails(req.params.recipeId);
    res.send(recipe);
  } catch (error) {
    next(error);
  }
})


// --- GET /recipes   (main page) -------------------------------------------
// • משתמש מחובר  → שלושת המתכונים האחרונים שצפה בהם (preview בלבד)
// • לא מחובר      → 3 מתכונים אקראיים (preview)
// --------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    let previews = [];

    if (req.session && req.session.user_id) {
      // 1. נשלוף את 3 הצפיות האחרונות
      const watched = await user_utils.getLastWatchedRecipes(req.session.user_id, 3);
      if (watched.length) {
        const ids = watched.map(r => r.recipe_id);
        previews  = await recipes_utils.getRecipesPreview(ids);
      }

      // 2. אם פחות מ-3, נמלא ברנדום
      if (previews.length < 3) {
        const rand = await recipes_utils.getRandomRecipes(3 - previews.length);
        previews   = previews.concat(rand);
      }
    } else {
      // לא מחובר → 3 רנדומליים
      previews = await recipes_utils.getRandomRecipes(3);
    }

    res.status(200).send(previews);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {

module.exports = router;
