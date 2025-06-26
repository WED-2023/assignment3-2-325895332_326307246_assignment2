var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

/**
 * Middleware to authenticate all incoming requests.
 * Attaches user_id to req if session is valid, otherwise returns 401.
 */
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users").then((users) => {
      if (users.find((x) => x.user_id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        next();
      }
    }).catch(err => next(err));
  } else {
    res.sendStatus(401);
  }
});

/**
 * Toggle a recipe in the favorites list of the logged-in user.
 * Expects: { recipeId, isSpoonacular } in req.body
 */
router.post('/favorites', async (req,res,next) => {
  try{
    const user_id = req.session.user_id;
    const { recipeId, isSpoonacular = true } = req.body;

    // Input validation
    if (
      recipeId === undefined ||
      recipeId === null ||
      recipeId === "" ||
      (typeof isSpoonacular !== "boolean" && typeof isSpoonacular !== "undefined")
    ) {
      throw { status: 400, message: "Invalid input for favorite recipe" };
    }

    const exists = await recipe_utils.recipeExists(recipeId, isSpoonacular);
    if (!exists) {
      throw { status: 404, message: "Recipe not found" };
    }
    
    const isNowFavorite = await user_utils.toggleFavorite(user_id, recipeId, isSpoonacular);
    const message = isNowFavorite ? 
      "The Recipe successfully added to favorites" : 
      "The Recipe successfully removed from favorites";
    
    res.status(200).send({ message, isFavorite: isNowFavorite, success: true });
    } catch(error){
    next(error);
  }
})

/**
 * Get all favorite recipes for the logged-in user.
 * Returns an array of recipe previews.
 */
router.get("/favorites", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) throw { status: 401, message: "Unauthorized" };

    const allFavs = (await user_utils.getFavoriteRecipes(user_id))
      .filter(r => r.recipe_id);

    const spoonIds = allFavs.filter(r => r.isSpoonacular);
    const localIds = allFavs.filter(r => !r.isSpoonacular);

    const spoonPreviews = await Promise.all(
      spoonIds.map(r => recipe_utils.getRecipePreview(r.recipe_id, true))
    );
    const localPreviews = await Promise.all(
      localIds.map(r => recipe_utils.getRecipePreview(r.recipe_id, false))
    );

    res.status(200).send([...spoonPreviews, ...localPreviews]);
  } catch (error) {
    next(error);
  }
});

/**
 * Get all family recipes created by the logged-in user.
 * Returns an array of recipe previews.
 */
router.get('/familyRecipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) throw { status: 401, message: "Unauthorized" };

    const recipes = await DButils.execQuery(
      `SELECT recipe_id FROM Recipes WHERE user_id = '${user_id}' AND isFamilyRecipe = true`
    );
    const previews = await Promise.all(
      recipes.map(r => recipe_utils.getRecipePreview(r.recipe_id, false))
    );
    res.status(200).send(previews);
  } catch (error) {
    next(error);
  }
});

/**
 * Get all recipes created by the logged-in user.
 * Returns an array of recipe previews.
 */
router.get('/myRecipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) throw { status: 401, message: "Unauthorized" };

    const recipes = await DButils.execQuery(
      `SELECT recipe_id FROM Recipes WHERE user_id = '${user_id}'`
    );
    const previews = await Promise.all(
      recipes.map(r => recipe_utils.getRecipePreview(r.recipe_id, false))
    );
    res.status(200).send(previews);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
