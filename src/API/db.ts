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
pool.query('CREATE TABLE IF NOT EXISTS credentials (id VARCHAR(64) PRIMARY KEY, publicKey VARCHAR(64) NOT NULL, algorithm VARCHAR(20) NOT NULL);')

type AuthCredential = { id: string, publicKey: string, algorithm: string };

const setChallenge = (challenge: string) => {
  pool.query('DELETE FROM challenges', (error: Error, results: string) => {
    if (error) { throw error; }
    pool.query('INSERT INTO challenges (challenge) VALUES ($1)', [challenge], (error: Error, results: string) => {
      if (error) { throw error; }
      return results;
    });
  });
}

const getChallenge = async (): Promise<string> => {
  return pool.query('SELECT challenge FROM challenges', (error: Error, results: any) => {
    if (error) {
      throw error;
    }
    console.log('getChallenge', results.rows[0])
    return results.rows.length ? results.rows[0] : null;
  });
}

const clearChallenge = (challenge: string) => {
  pool.query('DELETE FROM challenges WHERE challenge = $1', [challenge], (error: Error) => {
    if (error) {
      throw error;
    }
  });
}

const addCredential = (credential: AuthCredential) => {
  pool.query('INSERT INTO credentials (id, publicKey, algorithm) VALUES ($1, $2, $3)', [credential.id, credential.publicKey, credential.algorithm], (error: Error, results: AuthCredential) => {
    if (error) {
      throw error;
    }
    return results;
  });
}

const getCredential = (id: string) => {
  pool.query('SELECT * FROM credentials WHERE id = $1', [id], (error: Error, results: AuthCredential[]) => {
    if (error) {
      throw error;
    }
    return results?.length ? [0] : null;
  });
}

module.exports = {
  setChallenge,
  getChallenge,
  clearChallenge,
  addCredential,
  getCredential
}

