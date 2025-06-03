var mysql = require('mysql2');
require("dotenv").config();


const config={
  connectionLimit:4,
  host: process.env.host,
  user: process.env.user,
  password: process.env.DBpassword,
  database:process.env.database
}
const pool = new mysql.createPool(config);

/**
 * Gets a MySQL connection from the pool and provides query/release helpers.
 * @returns {Promise<{query: function, release: function}>}
 */
const connection =  () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) reject(err);
      /**
       * Executes a SQL query using this connection.
       * @param {string} sql - The SQL query.
       * @param {any[]} [binding] - Optional query bindings.
       * @returns {Promise<any>}
       */
      const query = (sql, binding) => {
        return new Promise((resolve, reject) => {
          connection.query(sql, binding, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });
      };
      /**
       * Releases the connection back to the pool.
       * @returns {Promise<void>}
       */
      const release = () => {
        return new Promise((resolve, reject) => {
          if (err) reject(err);
          resolve(connection.release());
        });
      };
      resolve({ query, release });
    });
  });
};

/**
 * Executes a SQL query using the pool (no explicit transaction).
 * @param {string} sql - The SQL query.
 * @param {any[]} [binding] - Optional query bindings.
 * @returns {Promise<any>}
 */
const query = (sql, binding) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, binding, (err, result, fields) => {
      if (err) reject(err);
      resolve(result);
    });
  });
};

module.exports = { pool, connection, query };







