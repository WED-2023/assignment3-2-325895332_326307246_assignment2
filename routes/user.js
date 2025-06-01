var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

/**
 * Authenticate all incoming requests by middleware
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
 * This path gets body with recipeId and save this recipe in the favorites list of the logged-in user
 */
router.post('/favorites', async (req,res,next) => {
  try{
    const user_id = req.session.user_id;
    // TODO: validate isSpoonacular כאילו אם צריך לבדוק 
    const { recipeId, isSpoonacular = true } = req.body;
    await user_utils.markAsFavorite(user_id, recipeId, isSpoonacular);
    res.status(200).send("The Recipe successfully saved as favorite");
    } catch(error){
    next(error);
  }
})

/**
 * This path returns the favorites recipes that were saved by the logged-in user
 */
// router.get('/favorites', async (req,res,next) => {
//   try{
//     const user_id = req.session.user_id;
//     let favorite_recipes = {};
//     const recipes = await user_utils.getFavoriteRecipes(user_id);
//     let recipes_id_array = [];
//     recipes.map((element) => recipes_id_array.push(element.recipe_id)); //extracting the recipe ids into array
//     const results = await recipe_utils.getRecipesPreview(recipes_id_array);
//     res.status(200).send(results);
//   } catch(error){
//     next(error); 
//   }
// });


router.get("/favorites", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;

    // שליפת כל המועדפים + סינון רשומות פגומות (recipe_id ריק)
    const allFavs = (await user_utils.getFavoriteRecipes(user_id))
      .filter(r => r.recipe_id);

    // הפרדה לפי מקור
    const spoonIds = allFavs.filter(r => r.isSpoonacular);
    const localIds = allFavs.filter(r => !r.isSpoonacular);

    // תצוגות מקדימות במקביל
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
 * This path returns all family recipes created by the logged-in user (from DB only)
 */
router.get('/familyRecipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    // Get all family recipes from DB where user_id matches and isFamilyRecipe is true
    const recipes = await DButils.execQuery(
      `SELECT recipe_id FROM Recipes WHERE user_id = '${user_id}' AND isFamilyRecipe = true`
    );
    // Return previews for these recipes
    const previews = await Promise.all(
      recipes.map(r => recipe_utils.getRecipePreview(r.recipe_id, false))
    );
    res.status(200).send(previews);
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns all recipes created by the logged-in user (from DB only)
 */
router.get('/myRecipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    // Get all family recipes from DB where user_id matches and isFamilyRecipe is true
    const recipes = await DButils.execQuery(
      `SELECT recipe_id FROM Recipes WHERE user_id = '${user_id}'`
    );
    // Return previews for these recipes
    const previews = await Promise.all(
      recipes.map(r => recipe_utils.getRecipePreview(r.recipe_id, false))
    );
    res.status(200).send(previews);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
