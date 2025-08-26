/**
 * User Routes Module
 * 
 * Handles user-specific operations and protected endpoints that require authentication.
 * All routes in this module are protected by authentication middleware and provide
 * personalized functionality for logged-in users.
 * 
 * Features:
 * - User authentication verification middleware
 * - Favorite recipe management (add/remove/list)
 * - Personal recipe collection retrieval
 * - Family recipe management
 * - User-specific data operations with privacy protection
 */

var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

/**
 * Authentication Middleware
 * Protects all routes in this module by verifying user session validity
 * Automatically attaches user_id to request object for authenticated users
 * Returns 401 Unauthorized for invalid or missing sessions
 */
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    // Verify user exists in database to prevent stale sessions
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
 * POST /favorites
 * Toggles a recipe's favorite status for the authenticated user
 * Smart toggle: adds if not favorited, removes if already favorited
 * Expects: { recipeId, isSpoonacular } in request body
 */
router.post('/favorites', async (req,res,next) => {
  try{
    const user_id = req.session.user_id;
    const { recipeId, isSpoonacular } = req.body;

    console.log('Favorites toggle request:', { recipeId, isSpoonacular, body: req.body });

    // Input validation
    if (
      recipeId === undefined ||
      recipeId === null ||
      recipeId === ""
    ) {
      throw { status: 400, message: "Invalid input for favorite recipe - recipeId required" };
    }

    // isSpoonacular must be explicitly provided - no defaulting
    if (isSpoonacular === undefined || typeof isSpoonacular !== "boolean") {
      throw { status: 400, message: "isSpoonacular parameter is required and must be boolean" };
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

    console.log('All favorites from DB:', allFavs);

    // Explicitly convert isSpoonacular to boolean and filter with strict boolean comparison
    const spoonIds = allFavs.filter(r => Boolean(r.isSpoonacular) === true);
    const localIds = allFavs.filter(r => Boolean(r.isSpoonacular) === false);

    console.log('Spoonacular favorites:', spoonIds);
    console.log('Local DB favorites:', localIds);

    const spoonPreviews = await Promise.all(
      spoonIds.map(r => recipe_utils.getRecipePreview(r.recipe_id, true, user_id))
    );
    const localPreviews = await Promise.all(
      localIds.map(r => recipe_utils.getRecipePreview(r.recipe_id, false, user_id))
    );

    console.log('Spoonacular previews:', spoonPreviews);
    console.log('Local previews:', localPreviews);

    // Ensure each preview has correct source information
    const allPreviews = [
      ...spoonPreviews.map(recipe => ({
        ...recipe,
        isFavorite: true,
        isSpoonacular: true,
        source: 'spoon'
      })),
      ...localPreviews.map(recipe => ({
        ...recipe,
        isFavorite: true,
        isSpoonacular: false,
        source: 'db'
      }))
    ];

    console.log('Final favorites response:', allPreviews);

    res.status(200).send(allPreviews);
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
      recipes.map(r => recipe_utils.getRecipePreview(r.recipe_id, false, user_id))
    );
    
    // Get user's favorites and filter for DB recipes only
    const favorites = await user_utils.getFavoriteRecipes(user_id);
    const dbFavorites = new Set(
      favorites.filter(f => Boolean(f.isSpoonacular) === false)
               .map(f => String(f.recipe_id))
    );
    
    // Add favorite status based on DB favorites only
    const recipesWithFavorites = previews.map(recipe => ({
      ...recipe,
      isFavorite: dbFavorites.has(String(recipe.id)),
      isSpoonacular: false,
      source: 'db'
    }));
    
    res.status(200).send(recipesWithFavorites);
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
      recipes.map(r => recipe_utils.getRecipePreview(r.recipe_id, false, user_id))
    );
    
    // Get user's favorites and filter for DB recipes only
    const favorites = await user_utils.getFavoriteRecipes(user_id);
    const dbFavorites = new Set(
      favorites.filter(f => Boolean(f.isSpoonacular) === false)
               .map(f => String(f.recipe_id))
    );
    
    // Add favorite status based on DB favorites only
    const recipesWithFavorites = previews.map(recipe => ({
      ...recipe,
      isFavorite: dbFavorites.has(String(recipe.id)),
      isSpoonacular: false,
      source: 'db'
    }));
    
    res.status(200).send(recipesWithFavorites);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
