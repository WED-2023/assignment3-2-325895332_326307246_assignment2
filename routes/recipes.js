// routes/recipes.js
const express = require("express");
const router  = express.Router();

const recipes_utils = require("./utils/recipes_utils");
const user_utils    = require("./utils/user_utils");

// --- GET /recipes   (main page) -------------------------------------------
// • משתמש מחובר  → שלושת המתכונים האחרונים שצפה בהם (preview בלבד)
// • לא מחובר      → 3 מתכונים אקראיים (preview)
// --------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const payload = { random: [], lastWatched: [] };

    // Always show 3 random Spoonacular recipes
    payload.random = await recipes_utils.getRandomRecipes(3);

    if (req.session?.user_id) {
      // User is logged in: show last watched
      const watchedRows = await user_utils.getLastWatchedRecipes(
        req.session.user_id,
        3
      );
      if (watchedRows.length) {
        payload.lastWatched = await Promise.all(
          watchedRows.map(w =>
            recipes_utils.getRecipePreview(w.recipe_id, Boolean(w.isSpoonacular))
          )
        );
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

// --- POST /recipes  (create new recipe) -----------------------------------
// • דורש session.valid
// • גוף הבקשה חייב להכיל את כל שדות החובה (+ מערכי instructions / ingredients)
// • יוצר רשומה(ות) בטבלאות Recipes + Ingredients
// --------------------------------------------------------------------------
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
      popularity,
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

    // 4. יצירת המתכון ב-DB דרך util אחד מרוכז
    const recipe_id = await recipes_utils.createRecipe(
      user_id,
      {
        title,
        image,
        readyInMinutes,
        popularity,
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

// --------------------------------------------------------------------------
// הנתיבים שהיו קיימים מלפני כן (search, random, :recipeId) – ללא שינוי
// --------------------------------------------------------------------------

router.get("/search", async (req, res, next) => {
  try {
    const { query, number, cuisine, diet, intolerances } = req.query;
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

// --------------------------------------------------------------------------
// GET /recipes/:recipeId?source=db|spoon
//   • source חובה:  db  → מחפש ב-MySQL   |   spoon → Spoonacular
//   • אם source חסר / ערך לא מוכר → 400
// --------------------------------------------------------------------------
router.get("/:recipeId", async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const  source      = (req.query.source || "").toLowerCase();

    // 1. ולידציה לפרמטר source
    if (!["db", "spoon"].includes(source)) {
      return res.status(400).send({
        message: "query-param 'source' must be 'db' or 'spoon'"
      });
    }
    const isSpoonacular = source === "spoon";

    // 2. שליפת פרטי-מתכון ממקור מוגדר
    const recipe = await recipes_utils.getRecipeDetails(recipeId, isSpoonacular);
    recipe.source = source;                    // מוסיפים לשקיפות ל-frontend

    // 3. פעולות תלויות-משתמש: Watched + Favorite
    if (req.session?.user_id) {
      const uid = req.session.user_id;

      // צפייה אחרונה (שומר גם isSpoonacular בטבלה)
      await user_utils.markAsWatched(uid, recipeId, isSpoonacular);

      // בדיקת מועדפים עם אותו צירוף (id + מקור)
      const favs = await user_utils.getFavoriteRecipes(uid, isSpoonacular);
      recipe.isFavorite = favs.some(
        r => r.recipe_id == recipeId && r.isSpoonacular === isSpoonacular
      );
      recipe.isWatched = true;
    }

    res.status(200).send(recipe);
  } catch (err) {
    next(err);
  }
});


module.exports = router;
