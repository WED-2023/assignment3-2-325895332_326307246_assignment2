// routes/recipes.js
const express = require("express");
const router  = express.Router();

const recipes_utils = require("./utils/recipes_utils");
const user_utils    = require("./utils/user_utils");

/**
 * GET /recipes
 * Main page endpoint.
 * - If user is logged in: returns 3 last watched recipes (preview).
 * - If not logged in: returns 3 random Spoonacular recipes (preview).
 */
router.get("/", async (req, res, next) => {
  try {
    const payload = { random: [], lastWatched: [] };

    // Always show 3 random Spoonacular recipes
    payload.random = await recipes_utils.getRandomRecipes(3);

    // If user is logged in, check their favorites and add to random recipes
    if (req.session?.user_id) {
      const uid = req.session.user_id;
      const favorites = await user_utils.getFavoriteRecipes(uid);
      
      // Mark favorites in random recipes
      payload.random = payload.random.map(recipe => ({
        ...recipe,
        isSpoonacular: true,
        isFavorite: favorites.some(fav => 
          fav.recipe_id == recipe.id && Boolean(fav.isSpoonacular) === true
        )
      }));

      // Get last watched recipes
      const watchedRows = await user_utils.getLastWatchedRecipes(uid, 3);
      if (watchedRows.length) {
        const lastWatchedPreviews = await Promise.all(
          watchedRows.map(w =>
            recipes_utils.getRecipePreview(w.recipe_id, Boolean(w.isSpoonacular))
          )
        );
        
        // Mark favorites and isSpoonacular in last watched recipes
        payload.lastWatched = lastWatchedPreviews.map((recipe, index) => {
          const originalWatched = watchedRows[index];
          return {
            ...recipe,
            isSpoonacular: Boolean(originalWatched.isSpoonacular),
            isFavorite: favorites.some(fav => 
              fav.recipe_id == recipe.id && Boolean(fav.isSpoonacular) === Boolean(originalWatched.isSpoonacular)
            )
          };
        });
      }
    } else {
      // User is not logged in: show login option
      payload.lastWatched = { loginRequired: true, loginUrl: "/login" };
    }

    res.status(200).send(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /recipes
 * Create a new recipe for the logged-in user.
 * Expects all required fields in req.body.
 * Validates input and creates records in Recipes and Ingredients tables.
 */
router.post("/", async (req, res, next) => {
  try {
    // 1. אימות התחברות
    if (!(req.session && req.session.user_id)) {
      throw { status: 401, message: "Login required" };
    }
    const user_id = req.session.user_id;

    // 2. פירוק גוף הבקשה
    const {
      title,
      image,
      readyInMinutes,
      vegan,
      vegetarian,
      glutenFree,
      servings,
      instructions,
      ingredients,
      isFamilyRecipe = false,
      familyStory    = null
    } = req.body;

    // 3. ולידציה בסיסית
    if (
      !title || !readyInMinutes || !servings ||
      !Array.isArray(instructions) || !instructions.length ||
      !Array.isArray(ingredients) || !ingredients.length
    ) {
      throw { status: 400, message: "Missing mandatory fields" };
    }

    // Input validation
    if (
      typeof title !== "string" || !title.trim() ||
      typeof readyInMinutes !== "number" || readyInMinutes <= 0 ||
      typeof servings !== "number" || servings <= 0 ||
      !Array.isArray(instructions) || !instructions.length ||
      !Array.isArray(ingredients) || !ingredients.length ||
      (typeof vegan !== "undefined" && typeof vegan !== "boolean") ||
      (typeof vegetarian !== "undefined" && typeof vegetarian !== "boolean") ||
      (typeof glutenFree !== "undefined" && typeof glutenFree !== "boolean") ||
      (typeof isFamilyRecipe !== "undefined" && typeof isFamilyRecipe !== "boolean")
    ) {
      throw { status: 400, message: "Invalid or missing mandatory fields" };
    }

    // Validate each instruction and ingredient
    if (!instructions.every(i => typeof i === "string" && i.trim())) {
      throw { status: 400, message: "Instructions must be non-empty strings" };
    }
    if (!ingredients.every(i =>
      (typeof i === "string" && i.trim()) ||
      (typeof i === "object" && typeof i.name === "string" && i.name.trim() && typeof i.quantity === "string" && i.quantity.trim())
    )) {
      throw { status: 400, message: "Ingredients must be valid strings or objects with name and quantity" };
    }

    // 4. יצירת המתכון ב-DB דרך util אחד מרוכז
    const recipe_id = await recipes_utils.createRecipe(
      user_id,
      {
        title,
        image,
        readyInMinutes,
        vegan,
        vegetarian,
        glutenFree,
        servings,
        instructions,
        ingredients,
        isFamilyRecipe,
        familyStory
      }
    );

    res.status(201).send({ recipe_id, message: "Recipe created" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /recipes/search
 * Search for recipes using Spoonacular API with filters.
 * Expects: query (required), number, cuisine, diet, intolerances in req.query.
 */
router.get("/search", async (req, res, next) => {
  try {
    const { query, number, cuisine, diet, intolerances } = req.query;
    // Input validation
    if (typeof query !== "string" || !query.trim()) {
      throw { status: 400, message: "Query parameter is required" };
    }
    const allowedNumbers = [5, 10, 15];
    let num = parseInt(number);
    if (!allowedNumbers.includes(num)) num = 5;
    const results = await recipes_utils.searchRecipes(
      query,
      num,
      cuisine,
      diet,
      intolerances
    );
    res.status(200).send(results);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /recipes/:recipeId?source=db|spoon
 * Get detailed information for a recipe by ID and source.
 * - source must be 'db' or 'spoon'
 * - If user is logged in, marks as watched and checks favorite status.
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    let source = (req.query.source || "spoon").toLowerCase();

    // Input validation
    if (!recipeId || typeof recipeId !== "string" && typeof recipeId !== "number") {
      return res.status(400).send({ message: "Invalid recipeId" });
    }
    
    // Default to spoon if source is not valid
    if (!["db", "spoon"].includes(source)) {
      source = "spoon";
    }
    
    const isSpoonacular = source === "spoon";

    // Get recipe details
    const recipe = await recipes_utils.getRecipeDetails(recipeId, isSpoonacular);
    recipe.source = source;
    recipe.isSpoonacular = isSpoonacular;

    // User-dependent operations: Watched + Favorite
    if (req.session?.user_id) {
      const uid = req.session.user_id;

      // Mark as watched
      await user_utils.markAsWatched(uid, recipeId, isSpoonacular);

      // Check if favorite
      const favs = await user_utils.getFavoriteRecipes(uid);
      recipe.isFavorite = favs.some(
        r => r.recipe_id == recipeId && Boolean(r.isSpoonacular) === isSpoonacular
      );
      recipe.isWatched = true;
    }

    res.status(200).send(recipe);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
