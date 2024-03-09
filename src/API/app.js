const express = require('express');
const axios = require('axios');
const cors = require('cors');

const { OAuth2Client } = require('google-auth-library');
const oauth2Client = new OAuth2Client()

const app = express();

// Enable CORS for all routes
app.use(cors());

// 1. Call the Google SDK from the frontend using whatever frontend
//2. Extract the code or access token and send to your backend for verification.
//3. Use your backend Google api to verify the code or token.
//4. If verified, sign them in the backend and then send a response to frontend

app.post('/auth', async (req, res) => {
  try {
    // get the code from frontend
    const code = req.headers.authorization;
    console.log('Authorization Code:', code);

    // Exchange the authorization code for an access token
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: '316624811771-jugmh69v4b636shvv1c9gtj6glr5i9e7.apps.googleusercontent.com',
        client_secret: process.env.GoogleClientSecret,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code'
      }
    );
    const accessToken = response.data.access_token;
    console.log('Access Token:', accessToken);

    // Fetch user details using the access token
    const userResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    const userDetails = userResponse.data;
    console.log('User Details:', userDetails);

    // Process user details and perform necessary actions

    res.status(200).json({ message: 'Authentication successful' });
  } catch (error) {
    console.error('Error saving code:', error);
    res.status(500).json({ message: 'Failed to save code' });
  }
});


app.listen(4000, () => {
  console.log('Server running on port 4000');
});
