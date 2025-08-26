/**
 * MySQL Database Connection Module
 * 
 * This module manages MySQL database connections using connection pooling
 * for optimal performance and resource management. Provides both pooled
 * connections and direct query execution capabilities.
 * 
 * Features:
 * - Connection pooling for concurrent request handling
 * - Environment-based configuration
 * - Promise-based query execution
 * - Automatic connection lifecycle management
 * - Error handling and connection cleanup
 */

var mysql = require('mysql2');
require("dotenv").config();

// Database connection pool configuration
const config = {
  connectionLimit: 4,                    // Maximum concurrent connections
  host: process.env.host,               // Database server hostname
  user: process.env.user,               // Database username
  password: process.env.DBpassword,     // Database password
  database: process.env.database        // Database name
}
const pool = new mysql.createPool(config);

/**
 * Retrieves a MySQL connection from the pool with enhanced query capabilities
 * Provides a promise-based interface for database operations
 * @returns {Promise<{query: function, release: function}>} Connection object with query and release methods
 * @throws {Error} Connection errors from the database pool
 */
const connection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) reject(err);
      
      /**
       * Executes a SQL query using this specific connection
       * @param {string} sql - The SQL query string to execute
       * @param {any[]} [binding] - Optional parameter bindings for prepared statements
       * @returns {Promise<any>} Query results from the database
       * @throws {Error} SQL execution errors
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
       * Releases the connection back to the connection pool
       * Should always be called after query operations complete
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







