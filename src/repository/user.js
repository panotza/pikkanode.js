const mysqlErrors = require('mysql2/lib/constants/errors')
const pool = require('../db')

async function register (email, password) {
  try {
    const [result] = await pool.query(`
      insert into users
        (email, password)
      values
        (?, ?)
    `, [ email, password ])
    return result.insertId
  } catch (err) {
    if (err.errno === mysqlErrors.ER_DUP_ENTRY) {
      throw new Error('err_dup_entry')
    }
    throw err
  }
}

async function getPasswordByEmail (email) {
  const [rows] = await pool.query(`
    select password
    from users
    where email = ?
  `, [ email ])
  return rows[0] && rows[0].password
}

async function getIdByEmail (email) {
  const [rows] = await pool.query(`
    select id
    from users
    where email = ?
  `, [ email ])
  return rows[0] && rows[0].id
}

async function getEmailById (userId) {
  const [rows] = await pool.query(`
    select email
    from users
    where id = ?
  `, [ userId ])
  return rows[0] && rows[0].email
}

module.exports = {
  register,
  getPasswordByEmail,
  getIdByEmail,
  getEmailById
}
