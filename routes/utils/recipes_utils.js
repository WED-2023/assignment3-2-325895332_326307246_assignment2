const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";
const api_key = process.env.spooncular_apiKey;

/**
 * שולף את כל המידע של מתכון חיצוני (ללא תזונה)
 */
async function getRecipeInformation(recipe_id) {
  return axios.get(
    `${api_domain}/${recipe_id}/information`,
    { params: { includeNutrition: false, apiKey: api_key } }
  );
}

/**
 * ממיר תשובת API לאובייקט תצוגה מקדימה
 */
async function getRecipePreview(recipe_id) {
  const res = await getRecipeInformation(recipe_id);
  const { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree } = res.data;
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
 * מקבילית: משוך תצוגה מקדימה עבור מערך IDs
 */
async function getRecipesPreview(recipe_ids_array) {
  return Promise.all(
    recipe_ids_array.map(id => getRecipePreview(id))
  );
}

/**
 * מחזיר פירוט מלא של מתכון חיצוני: מרכיבים, הוראות, מנות וכו'
 */
async function getRecipeDetails(recipe_id) {
  const res = await getRecipeInformation(recipe_id);
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

/**
 * חיפוש מתכונים חיצוניים לפי מחרוזת וסינונים (מטבח, דיאטה, אי־סבילויות)
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
