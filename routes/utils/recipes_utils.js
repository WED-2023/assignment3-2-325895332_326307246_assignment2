// recipes_utils.js
const axios = require("axios");
const DButils = require("./DButils");
const api_domain = "https://api.spoonacular.com/recipes";
const api_key = process.env.spooncular_apiKey;

/**
 * שולף את המידע של מתכון, חיצוני או משפחתי
 * @param {string|number} recipe_id
 * @param {boolean} [isSpoonacular=true] – true לקרוא ל-API, false ל־DB
 * @returns {Promise<{ data: object }>} – תמיד מחזיר אובייקט עם המפתח .data
 */
async function getRecipeInformation(recipe_id, isSpoonacular = true) {
  if (!isSpoonacular) {
    // מקרים משפחתיים: שולפים מטבלת Recipes
    const rows = await DButils.execQuery(`
      SELECT
        recipe_id AS id,
        title,
        image,
        preparationTimeMinutes AS readyInMinutes,
        popularity AS aggregateLikes,
        isVegan AS vegan,
        isVegetarian AS vegetarian,
        isGlutenFree AS glutenFree,
        servings,
        instructions,
        isSpoonacular
      FROM Recipes
      WHERE recipe_id = ${recipe_id}
    `);
    if (!rows.length) {
      throw { status: 404, message: "Recipe not found in DB" };
    }
    // עוטפים בתצורה אחידה כמו AxiosResponse
    return { data: rows[0] };
  }
  // מקרים חיצוניים: קריאה ל־API
  const res = await axios.get(
    `${api_domain}/${recipe_id}/information`,
    { params: { includeNutrition: false, apiKey: api_key } }
  );
  return res;
}

/**
 * ממיר תשובת API/DB לאובייקט תצוגה מקדימה
 * @param {string|number} recipe_id
 * @param {boolean} [isSpoonacular=true]
 */
async function getRecipePreview(recipe_id, isSpoonacular = true) {
  const res = await getRecipeInformation(recipe_id, isSpoonacular);
  const {
    id,
    title,
    readyInMinutes,
    image,
    aggregateLikes,
    vegan,
    vegetarian,
    glutenFree
  } = res.data;
  return {
    id,
    title,
    readyInMinutes,
    image,
    popularity: aggregateLikes,
    vegan,
    vegetarian,
    glutenFree
  };
}

/**
 * מקבילית: תצוגות מקדימות למערך IDs
 * @param {Array<string|number>} recipe_ids_array
 * @param {boolean} [isSpoonacular=true]
 */
async function getRecipesPreview(recipe_ids_array, isSpoonacular = true) {
  return Promise.all(
    recipe_ids_array.map(id => getRecipePreview(id, isSpoonacular))
  );
}

/**
 * מחזיר פירוט מלא של מתכון, חיצוני או משפחתי
 * @param {string|number} recipe_id
 * @param {boolean} [isSpoonacular=true]
 */
async function getRecipeDetails(recipe_id, isSpoonacular = true) {
  // השימוש ב־getRecipeInformation יחזיר תמיד אובייקט עם .data
  const res = await getRecipeInformation(recipe_id, isSpoonacular);

  // במקרה חיצוני – extendedIngredients ועוד
  if (isSpoonacular) {
    const {
      id, title, readyInMinutes, image, aggregateLikes,
      vegan, vegetarian, glutenFree, servings,
      extendedIngredients, analyzedInstructions
    } = res.data;
    const ingredients = extendedIngredients.map(i => i.original);
    const instructions = analyzedInstructions.length
      ? analyzedInstructions[0].steps.map(step => step.step)
      : [];
    return {
      id,
      title,
      readyInMinutes,
      image,
      popularity: aggregateLikes,
      vegan,
      vegetarian,
      glutenFree,
      servings,
      ingredients,
      instructions
    };
  }

  // במקרה משפחתי – כבר קיבלנו מ-DB את השדות הבסיסיים
  const {
    id,
    title,
    readyInMinutes,
    image,
    aggregateLikes,
    vegan,
    vegetarian,
    glutenFree,
    servings,
    instructions
  } = res.data;

  // שולפים את רשימת החומרים מטבלת Ingredients
  const ingRows = await DButils.execQuery(`
    SELECT quantity, name
      FROM Ingredients
     WHERE recipe_id = ${recipe_id}
  `);
  const ingredients = ingRows.map(i => `${i.quantity} ${i.name}`);

  return {
    id,
    title,
    readyInMinutes,
    image,
    popularity: aggregateLikes,
    vegan: Boolean(vegan),
    vegetarian: Boolean(vegetarian),
    glutenFree: Boolean(glutenFree),
    servings,
    ingredients,
    instructions: instructions.split("\n") // או שמותאם לפי איך שמירתם בעמודה
  };
}

/**
 * חיפוש מתכונים חיצוניים לפי שם וסינונים
 */
async function searchRecipes(query, number = 10, cuisine, diet, intolerances) {
  const params = { query, number, addRecipeInformation: true, apiKey: api_key };
  if (cuisine)      params.cuisine      = Array.isArray(cuisine)      ? cuisine.join(',')      : cuisine;
  if (diet)         params.diet         = Array.isArray(diet)         ? diet.join(',')         : diet;
  if (intolerances) params.intolerances = Array.isArray(intolerances) ? intolerances.join(',') : intolerances;
  const response = await axios.get(`${api_domain}/complexSearch`, { params });
  return response.data.results.map(r => ({
    id: r.id,
    title: r.title,
    readyInMinutes: r.readyInMinutes,
    image: r.image,
    popularity: r.aggregateLikes,
    vegan: r.vegan,
    vegetarian: r.vegetarian,
    glutenFree: r.glutenFree
  }));
}

/**
 * מחזיר N מתכונים אקראיים
 */
async function getRandomRecipes(number = 10) {
  const response = await axios.get(`${api_domain}/random`, {
    params: { number, apiKey: api_key }
  });
  return response.data.recipes.map(r => ({
    id: r.id,
    title: r.title,
    readyInMinutes: r.readyInMinutes,
    image: r.image,
    popularity: r.aggregateLikes,
    vegan: r.vegan,
    vegetarian: r.vegetarian,
    glutenFree: r.glutenFree
  }));
}

module.exports = {
  getRecipeInformation,
  getRecipePreview,
  getRecipesPreview,
  getRecipeDetails,
  searchRecipes,
  getRandomRecipes
};
