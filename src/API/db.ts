require('dotenv').config();
const Pool = require('pg').Pool;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT
});

pool.query('CREATE TABLE IF NOT EXISTS challenges (challenge VARCHAR(64) UNIQUE NOT NULL);');
pool.query('CREATE TABLE IF NOT EXISTS credentials (id VARCHAR(64) PRIMARY KEY, publicKey VARCHAR(256) NOT NULL, algorithm VARCHAR(20) NOT NULL);')

type AuthCredential = { id: string, publicKey: string, algorithm: string };

const setChallenge = async (challenge: string): Promise<void> => {
  await pool.query('DELETE FROM challenges');
  await pool.query('INSERT INTO challenges (challenge) VALUES ($1)', [challenge]);
  return void (0);
}

const getChallenge = async (): Promise<string> => {
  const result = await pool.query('SELECT challenge FROM challenges');
  return result.rows.length ? result.rows[0].challenge : null;
}

const clearChallenge = async (challenge: string): Promise<void> => {
  await pool.query('DELETE FROM challenges WHERE challenge = $1', [challenge]);
  return void (0);
}

const addCredential = async (credential: AuthCredential): Promise<void> => {
  await pool.query('INSERT INTO credentials (id, publicKey, algorithm) VALUES ($1, $2, $3)', [credential.id, credential.publicKey, credential.algorithm]);
  return void (0);
}

const getCredential = async (id: string): Promise<AuthCredential> => {
  const result = await pool.query('SELECT * FROM credentials WHERE id = $1', [id]);
  return result.rows.length ? result.rows[0] : null;
}

module.exports = {
  setChallenge,
  getChallenge,
  clearChallenge,
  addCredential,
  getCredential
}

