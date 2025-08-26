/**
 * Recipes Routes Module
 * 
 * Handles all recipe-related API endpoints including retrieval, creation, and search.
 * Integrates both Spoonacular API data and local database recipes with user-specific
 * personalization features.
 * 
 * Features:
 * - Recipe retrieval from multiple sources (API and database)
 * - User-personalized recipe recommendations
 * - Recipe creation and management
 * - Advanced recipe search with filters
 * - User interaction tracking (favorites, viewing history)
 * - Cooking mode support with progress tracking
 */

const express = require("express");
const router = express.Router();

const recipes_utils = require("./utils/recipes_utils");
const user_utils = require("./utils/user_utils");

/**
 * GET /recipes
 * Main page endpoint providing personalized recipe recommendations
 * Returns different content based on user authentication status:
 * - Authenticated users: Random recipes + last watched recipes with favorite status
 * - Guest users: Random recipes from Spoonacular API
 */
router.get("/", async (req, res, next) => {
  try {
    const payload = { random: [], lastWatched: [] };
    const user_id = req.session?.user_id || null;

    // Provide 3 random Spoonacular recipes for all users
    payload.random = await recipes_utils.getRandomRecipes(3, user_id);

    // Add personalized content for authenticated users
    if (user_id) {
      // Get user's Spoonacular favorites for preference indication
      const DButils = require("./utils/DButils");
      const spoonacularFavoritesResult = await DButils.execQuery(`
        SELECT recipe_id FROM FavoriteRecipes 
        WHERE user_id = '${user_id}' AND isSpoonacular = 1
      `);
      const spoonacularFavoriteIds = new Set(spoonacularFavoritesResult.map(f => String(f.recipe_id)));
      
      // Apply favorites to random recipes
      payload.random = payload.random.map(recipe => ({
        ...recipe,
        isFavorite: spoonacularFavoriteIds.has(String(recipe.id))
      }));

      // Get last watched recipes
      const watchedRows = await user_utils.getLastWatchedRecipes(user_id, 3);
      if (watchedRows.length) {
        const lastWatchedPreviews = await Promise.all(
          watchedRows.map(w =>
            recipes_utils.getRecipePreview(w.recipe_id, Boolean(w.isSpoonacular), user_id)
          )
        );
        
        // Get DB favorites
        const dbFavoritesResult = await DButils.execQuery(`
          SELECT recipe_id FROM FavoriteRecipes 
          WHERE user_id = '${user_id}' AND isSpoonacular = 0
        `);
        const dbFavoriteIds = new Set(dbFavoritesResult.map(f => String(f.recipe_id)));
        
        // Apply source-specific favorites to last watched
        payload.lastWatched = lastWatchedPreviews.map((recipe, index) => {
          const originalWatched = watchedRows[index];
          const watchedIsSpoonacular = Boolean(originalWatched.isSpoonacular);
          
          let isFavorite = false;
          if (watchedIsSpoonacular) {
            isFavorite = spoonacularFavoriteIds.has(String(recipe.id));
          } else {
            isFavorite = dbFavoriteIds.has(String(recipe.id));
          }
          
          return {
            ...recipe,
            isSpoonacular: watchedIsSpoonacular,
            isFavorite: isFavorite
          };
        });
      }
    } else {
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
    const user_id = req.session?.user_id || null;
    
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
      intolerances,
      user_id
    );

    // Apply favorites ONLY here for Spoonacular recipes
    if (user_id) {
      const DButils = require("./utils/DButils");
      const spoonacularFavoritesResult = await DButils.execQuery(`
        SELECT recipe_id FROM FavoriteRecipes 
        WHERE user_id = '${user_id}' AND isSpoonacular = 1
      `);
      const spoonacularFavoriteIds = new Set(spoonacularFavoritesResult.map(f => String(f.recipe_id)));
      
      results.forEach(recipe => {
        recipe.isFavorite = spoonacularFavoriteIds.has(String(recipe.id));
      });
    }

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
    const user_id = req.session?.user_id || null;

    console.log('Recipe details request:', { recipeId, source, user_id });

    // Input validation
    if (!recipeId || typeof recipeId !== "string" && typeof recipeId !== "number") {
      return res.status(400).send({ message: "Invalid recipeId" });
    }
    
    // Default to spoon if source is not valid
    if (!["db", "spoon"].includes(source)) {
      source = "spoon";
    }
    
    const isSpoonacular = source === "spoon";

    // Get recipe details with explicit source parameter
    const recipe = await recipes_utils.getRecipeDetails(recipeId, isSpoonacular, user_id);
    recipe.source = source;
    recipe.isSpoonacular = isSpoonacular; // Ensure this is set correctly

    // User-dependent operations: Watched + Favorite
    if (user_id) {
      // Mark as watched with correct source
      await user_utils.markAsWatched(user_id, recipeId, isSpoonacular);

      // Check if favorite with correct source - use strict string comparison
      const favs = await user_utils.getFavoriteRecipes(user_id);
      recipe.isFavorite = favs.some(
        r => String(r.recipe_id) === String(recipeId) && Boolean(r.isSpoonacular) === isSpoonacular
      );
      recipe.isWatched = true;
      
      console.log('Recipe favorite check:', {
        recipeId,
        isSpoonacular,
        favorites: favs,
        isFavorite: recipe.isFavorite
      });
    }

    res.status(200).send(recipe);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /recipes/:recipeId/cooking-mode
 * Get recipe in cooking mode format with step-by-step instructions.
 * Supports quantity multiplier for adjusting servings.
 */
router.get("/:recipeId/cooking-mode", async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    let source = (req.query.source || "spoon").toLowerCase();
    const servingMultiplier = parseFloat(req.query.servings) || 1;
    const user_id = req.session?.user_id || null;

    // Input validation
    if (!recipeId || typeof recipeId !== "string" && typeof recipeId !== "number") {
      return res.status(400).send({ message: "Invalid recipeId" });
    }
    
    if (servingMultiplier <= 0) {
      return res.status(400).send({ message: "Invalid serving multiplier" });
    }
    
    // Default to spoon if source is not valid
    if (!["db", "spoon"].includes(source)) {
      source = "spoon";
    }
    
    const isSpoonacular = source === "spoon";

    // Get recipe details with explicit source parameter
    const recipe = await recipes_utils.getRecipeDetails(recipeId, isSpoonacular, user_id);
    
    // Adjust quantities if multiplier is provided
    if (servingMultiplier !== 1 && recipe.ingredients) {
      recipe.ingredients = recipe.ingredients.map(ingredient => {
        if (typeof ingredient === 'object' && ingredient.quantity) {
          // Extract numeric values and multiply
          const quantityMatch = ingredient.quantity.match(/(\d+(?:\.\d+)?)/);
          if (quantityMatch) {
            const originalQuantity = parseFloat(quantityMatch[1]);
            const newQuantity = (originalQuantity * servingMultiplier).toFixed(1);
            ingredient.quantity = ingredient.quantity.replace(quantityMatch[1], newQuantity);
          }
          return ingredient;
        } else if (typeof ingredient === 'string') {
          // For string ingredients, try to extract and multiply quantities
          const quantityMatch = ingredient.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
          if (quantityMatch) {
            const originalQuantity = parseFloat(quantityMatch[1]);
            const newQuantity = (originalQuantity * servingMultiplier).toFixed(1);
            return newQuantity + ' ' + quantityMatch[2];
          }
          return ingredient;
        }
        return ingredient;
      });
    }

    // Adjust servings
    if (recipe.servings) {
      recipe.servings = Math.round(recipe.servings * servingMultiplier);
    }

    // Format for cooking mode
    const cookingModeData = {
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      servings: recipe.servings,
      readyInMinutes: recipe.readyInMinutes,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      currentStep: 0,
      totalSteps: recipe.instructions ? recipe.instructions.length : 0,
      servingMultiplier: servingMultiplier,
      originalServings: recipe.servings ? Math.round(recipe.servings / servingMultiplier) : null,
      isSpoonacular: isSpoonacular, // Ensure this is set correctly
      source: source
    };

    res.status(200).send(cookingModeData);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /recipes/:recipeId/meal-plan
 * Add recipe to user's meal plan.
 */
router.post("/:recipeId/meal-plan", async (req, res, next) => {
  try {
    // Check authentication
    if (!(req.session && req.session.user_id)) {
      throw { status: 401, message: "Login required" };
    }
    const user_id = req.session.user_id;

    const { recipeId } = req.params;
    const { date, mealType, servings } = req.body;
    let source = (req.body.source || "spoon").toLowerCase();

    // Input validation
    if (!recipeId || typeof recipeId !== "string" && typeof recipeId !== "number") {
      return res.status(400).send({ message: "Invalid recipeId" });
    }
    
    if (!date || !mealType) {
      return res.status(400).send({ message: "Date and meal type are required" });
    }

    if (!["breakfast", "lunch", "dinner", "snack"].includes(mealType)) {
      return res.status(400).send({ message: "Invalid meal type" });
    }

    // Default to spoon if source is not valid
    if (!["db", "spoon"].includes(source)) {
      source = "spoon";
    }
    
    const isSpoonacular = source === "spoon";

    // Add to meal plan (this would require a meal plan table in the database)
    // For now, we'll return a success message
    const mealPlanEntry = {
      user_id,
      recipe_id: recipeId,
      isSpoonacular,
      date,
      mealType,
      servings: servings || 1,
      created_at: new Date()
    };

    res.status(201).send({ 
      message: "Recipe added to meal plan",
      mealPlan: mealPlanEntry
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /recipes/:recipeId/cooking-progress
 * Get saved cooking mode progress for the current session.
 */
router.get("/:recipeId/cooking-progress", async (req, res, next) => {
  try {
    // Check authentication
    if (!(req.session && req.session.user_id)) {
      throw { status: 401, message: "Login required" };
    }

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

    // Initialize cooking progress storage in session if it doesn't exist
    if (!req.session.cookingProgress) {
      req.session.cookingProgress = {};
    }

    const progressKey = `${recipeId}-${source}`;
    const progress = req.session.cookingProgress[progressKey] || {
      currentStep: 0,
      completedSteps: {},
      checkedIngredients: {},
      servingMultiplier: 1,
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    res.status(200).send(progress);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /recipes/:recipeId/cooking-progress
 * Save cooking mode progress for the current session.
 */
router.post("/:recipeId/cooking-progress", async (req, res, next) => {
  try {
    // Check authentication
    if (!(req.session && req.session.user_id)) {
      throw { status: 401, message: "Login required" };
    }

    const { recipeId } = req.params;
    let source = (req.body.source || "spoon").toLowerCase();
    const { currentStep, completedSteps, checkedIngredients, servingMultiplier } = req.body;

    // Input validation
    if (!recipeId || typeof recipeId !== "string" && typeof recipeId !== "number") {
      return res.status(400).send({ message: "Invalid recipeId" });
    }

    if (typeof currentStep !== "number" || currentStep < 0) {
      return res.status(400).send({ message: "Invalid currentStep" });
    }

    // Default to spoon if source is not valid
    if (!["db", "spoon"].includes(source)) {
      source = "spoon";
    }

    // Initialize cooking progress storage in session if it doesn't exist
    if (!req.session.cookingProgress) {
      req.session.cookingProgress = {};
    }

    const progressKey = `${recipeId}-${source}`;
    const existingProgress = req.session.cookingProgress[progressKey] || {};

    // Update progress
    req.session.cookingProgress[progressKey] = {
      ...existingProgress,
      currentStep: currentStep || 0,
      completedSteps: completedSteps || {},
      checkedIngredients: checkedIngredients || {},
      servingMultiplier: servingMultiplier || 1,
      lastUpdated: new Date().toISOString(),
      startTime: existingProgress.startTime || new Date().toISOString()
    };

    res.status(200).send({ 
      message: "Progress saved",
      progress: req.session.cookingProgress[progressKey]
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /recipes/:recipeId/cooking-progress
 * Clear cooking mode progress for a recipe.
 */
router.delete("/:recipeId/cooking-progress", async (req, res, next) => {
  try {
    // Check authentication
    if (!(req.session && req.session.user_id)) {
      throw { status: 401, message: "Login required" };
    }

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

    // Initialize cooking progress storage in session if it doesn't exist
    if (!req.session.cookingProgress) {
      req.session.cookingProgress = {};
    }

    const progressKey = `${recipeId}-${source}`;
    delete req.session.cookingProgress[progressKey];

    res.status(200).send({ message: "Progress cleared" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
