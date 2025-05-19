const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";



/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info 
 */


async function getRecipeInformation(recipe_id) {
    return await axios.get(`${api_domain}/${recipe_id}/information`, {
        params: {
            includeNutrition: false,
            apiKey: process.env.spooncular_apiKey
        }
    });
}

async function getRecipePreview(recipe_id) {
    let recipe_info = await getRecipeInformation(recipe_id);
    let { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree } = recipe_info.data;

    return {
        id: id,
        title: title,
        readyInMinutes: readyInMinutes,
        image: image,
        popularity: aggregateLikes,
        vegan: vegan,
        vegetarian: vegetarian,
        glutenFree: glutenFree,
        
    }
}

async function getRecipesPreview(recipe_ids_array) {
  return Promise.all(
    recipe_ids_array.map(async (id) => {
      return await getRecipePreview(id);
    })
  );
}

async function getRecipeDetails(recipe_id) {
  const recipe_info = await getRecipeInformation(recipe_id);
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
    extendedIngredients,
    analyzedInstructions
  } = recipe_info.data;

  const ingredients = extendedIngredients.map(ing => ing.original);
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

exports.getRecipeDetails = getRecipeDetails;
exports.getRecipesPreview = getRecipesPreview;
exports.getRecipePreview = getRecipePreview;



