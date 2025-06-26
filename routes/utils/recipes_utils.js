const axios = require("axios");
const DButils = require("./DButils");
const api_domain = "https://api.spoonacular.com/recipes";
const api_key = process.env.SPOONACULAR_API_KEY;

/**
 * Retrieves recipe information from Spoonacular API or local DB.
 * @param {string|number} recipe_id - The recipe's ID.
 * @param {boolean} [isSpoonacular=false] - If true, fetch from Spoonacular; else from DB.
 * @returns {Promise<{ data: object }>} - Object with .data property containing recipe info.
 * @throws {object} If recipe_id is invalid or not found.
 */
async function getRecipeInformation(recipe_id, isSpoonacular = false) {
  if (
    recipe_id === undefined ||
    recipe_id === null ||
    recipe_id === "" ||
    (isSpoonacular !== undefined && typeof isSpoonacular !== "boolean")
  ) {
    throw { status: 400, message: "Invalid recipe_id or isSpoonacular" };
  }
  if (!isSpoonacular) {
    const id = parseInt(recipe_id, 10);
    if (Number.isNaN(id)) {
      throw { status: 400, message: "recipe_id must be numeric for DB source" };
    }
    const rows = await DButils.execQuery(`
      SELECT
        recipe_id AS id,
        title,
        image,
        preparationTimeMinutes AS readyInMinutes,
        isVegan        AS vegan,
        isVegetarian   AS vegetarian,
        isGlutenFree   AS glutenFree,
        servings,
        instructions,
        FALSE          AS isSpoonacular
      FROM Recipes
      WHERE recipe_id = ${id}
    `);
    if (!rows.length) {
      throw { status: 404, message: "Recipe not found in DB" };
    }
    return { data: rows[0] };
  }
  const res = await axios.get(
    `${api_domain}/${recipe_id}/information`,
    { params: { includeNutrition: false, apiKey: api_key } }
  );
  return res;
}

/**
 * Returns a preview object for a recipe.
 * @param {string|number} recipe_id - The recipe's ID.
 * @param {boolean} [isSpoonacular=false] - If true, fetch from Spoonacular.
 * @returns {Promise<object>} - Preview object.
 */
async function getRecipePreview(recipe_id, isSpoonacular = false) {
  if (
    recipe_id === undefined ||
    recipe_id === null ||
    recipe_id === "" ||
    (isSpoonacular !== undefined && typeof isSpoonacular !== "boolean")
  ) {
    throw { status: 400, message: "Invalid recipe_id or isSpoonacular" };
  }
  const res = await getRecipeInformation(recipe_id, isSpoonacular);
  const {
    id,
    title,
    readyInMinutes,
    image,
    vegan,
    vegetarian,
    glutenFree
  } = res.data;
  return {
    id,
    title,
    readyInMinutes,
    image,
    vegan,
    vegetarian,
    glutenFree,
    isSpoonacular // Add this property to ensure it's always present
  };
}

/**
 * Returns preview objects for an array of recipe IDs.
 * @param {Array<string|number>} recipe_ids_array - Array of recipe IDs.
 * @param {boolean} [isSpoonacular=false] - If true, fetch from Spoonacular.
 * @returns {Promise<Array<object>>}
 */
async function getRecipesPreview(recipe_ids_array, isSpoonacular = false) {
  if (
    !Array.isArray(recipe_ids_array) ||
    recipe_ids_array.length === 0 ||
    (isSpoonacular !== undefined && typeof isSpoonacular !== "boolean")
  ) {
    throw { status: 400, message: "Invalid recipe_ids_array or isSpoonacular" };
  }
  return Promise.all(
    recipe_ids_array.map(id => getRecipePreview(id, isSpoonacular))
  );
}

/**
 * Returns detailed information for a recipe.
 * @param {string|number} recipe_id - The recipe's ID.
 * @param {boolean} [isSpoonacular=false] - If true, fetch from Spoonacular.
 * @returns {Promise<object>} - Detailed recipe object.
 */
async function getRecipeDetails(recipe_id, isSpoonacular = false) {
  if (
    recipe_id === undefined ||
    recipe_id === null ||
    recipe_id === "" ||
    (isSpoonacular !== undefined && typeof isSpoonacular !== "boolean")
  ) {
    throw { status: 400, message: "Invalid recipe_id or isSpoonacular" };
  }
  const res = await getRecipeInformation(recipe_id, isSpoonacular);
  if (isSpoonacular) {
    const {
      id, title, readyInMinutes, image,
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
      vegan,
      vegetarian,
      glutenFree,
      servings,
      ingredients,
      instructions
    };
  }
  const {
    id,
    title,
    readyInMinutes,
    image,
    vegan,
    vegetarian,
    glutenFree,
    servings,
    instructions
  } = res.data;
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
    vegan: Boolean(vegan),
    vegetarian: Boolean(vegetarian),
    glutenFree: Boolean(glutenFree),
    servings,
    ingredients,
    instructions: instructions.split("\n")
  };
}

/**
 * Searches for recipes using Spoonacular API with filters.
 * @param {string} query - Search query.
 * @param {number} [number=5] - Number of results.
 * @param {string|string[]} [cuisine] - Cuisine filter.
 * @param {string|string[]} [diet] - Diet filter.
 * @param {string|string[]} [intolerances] - Intolerances filter.
 * @returns {Promise<Array<object>>} - Array of recipe previews.
 */
async function searchRecipes(query, number = 5, cuisine, diet, intolerances) {
  if (
    typeof query !== "string" ||
    !query.trim() ||
    (number !== undefined && (typeof number !== "number" || number <= 0))
  ) {
    throw { status: 400, message: "Invalid search parameters" };
  }
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
    vegan: r.vegan,
    vegetarian: r.vegetarian,
    glutenFree: r.glutenFree
  }));
}

/**
 * Returns N random recipes from Spoonacular API.
 * @param {number} [number=10] - Number of random recipes.
 * @returns {Promise<Array<object>>} - Array of recipe previews.
 */
async function getRandomRecipes(number = 10) {
  if (number !== undefined && (typeof number !== "number" || number <= 0)) {
    throw { status: 400, message: "Invalid number for random recipes" };
  }
  const response = await axios.get(`${api_domain}/random`, {
    params: { number, apiKey: api_key }
  });
  return response.data.recipes.map(r => ({
    id: r.id,
    title: r.title,
    readyInMinutes: r.readyInMinutes,
    image: r.image,
    vegan: r.vegan,
    vegetarian: r.vegetarian,
    glutenFree: r.glutenFree
  }));
}

/**
 * Creates a new recipe in the local database and returns its ID.
 * @param {number} user_id - The creator's user ID.
 * @param {object} data - Recipe data.
 * @returns {Promise<number>} - The created recipe's ID.
 */
async function createRecipe(user_id, data) {
  if (
    user_id === undefined || user_id === null || user_id === "" ||
    typeof data !== "object" || data === null
  ) {
    throw { status: 400, message: "Invalid user_id or data" };
  }
  const {
    title,
    image           = null,
    readyInMinutes,
    vegan           = false,
    vegetarian      = false,
    glutenFree      = false,
    servings,
    instructions,
    ingredients,
    isFamilyRecipe  = false,
    familyStory     = {}
  } = data;
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
  if (!instructions.every(i => typeof i === "string" && i.trim())) {
    throw { status: 400, message: "Instructions must be non-empty strings" };
  }
  if (!ingredients.every(i =>
    (typeof i === "string" && i.trim()) ||
    (typeof i === "object" && typeof i.name === "string" && i.name.trim() && typeof i.quantity === "string" && i.quantity.trim())
  )) {
    throw { status: 400, message: "Ingredients must be valid strings or objects with name and quantity" };
  }
  const familyWho  = isFamilyRecipe ? familyStory.who  || null : null;
  const familyWhen = isFamilyRecipe ? familyStory.when || null : null;
  const insertRecipeSQL = `
    INSERT INTO Recipes
      (user_id, title, image, preparationTimeMinutes, 
       isVegan, isVegetarian, isGlutenFree, servings,
       instructions, isFamilyRecipe, familyWho, familyWhen)
    VALUES
      ('${user_id}', '${title}', ${image ? `'${image}'` : null},
       ${readyInMinutes},
       ${vegan ? 1 : 0}, ${vegetarian ? 1 : 0}, ${glutenFree ? 1 : 0},
       ${servings}, '${instructions}',
       ${isFamilyRecipe ? 1 : 0},
       ${familyWho  ? `'${familyWho}'`  : null},
       ${familyWhen ? `'${familyWhen}'` : null}
       )
  `;
  const result = await DButils.execQuery(insertRecipeSQL);
  const recipe_id = result.insertId;
  const ingValues = ingredients.map(ing => {
    if (typeof ing === "string") {
      const [qty, ...rest] = ing.trim().split(" ");
      return `(${recipe_id}, '${rest.join(" ")}', '${qty}')`;
    }
    return `(${recipe_id}, '${ing.name}', '${ing.quantity}')`;
  });
  if (ingValues.length) {
    const insertIngSQL = `
      INSERT INTO Ingredients (recipe_id, name, quantity)
      VALUES ${ingValues.join(",")}
    `;
    await DButils.execQuery(insertIngSQL);
  }
  return recipe_id;
}

/**
 * בודק אם מתכון קיים במקור המבוקש (DB מקומי או Spoonacular).
 * @param {string|number} recipe_id
 * @param {boolean} [isSpoonacular=true] – true → Spoonacular, false → DB
 * @returns {Promise<boolean>}           – true אם נמצא, אחרת false
 */
async function recipeExists(recipe_id, isSpoonacular = true) {
  if (!isSpoonacular) {
    // חיפוש מהיר ב-MySQL
    const rows = await DButils.execQuery(`
      SELECT 1
        FROM Recipes
       WHERE recipe_id = '${recipe_id}'
       LIMIT 1
    `);
    return rows.length > 0;
  }

  // חיפוש חיצוני via Spoonacular – קריאה קלה ל-/information
  try {
    await axios.get(
      `${api_domain}/${recipe_id}/information`,
      { params: { includeNutrition: false, apiKey: api_key } }
    );
    return true;             // קיבלנו 200 → קיים
  } catch (err) {
    // 404 → לא קיים; כל שגיאה אחרת (403 quota, 500 וכו') נזרקת הלאה
    if (err.response?.status === 404) return false;
    throw err;
  }
}

module.exports = {
  getRecipeInformation,
  getRecipePreview,
  getRecipesPreview,
  getRecipeDetails,
  searchRecipes,
  getRandomRecipes,
  createRecipe,
  recipeExists
};
