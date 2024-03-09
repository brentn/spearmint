const express = require('express');
const axios = require('axios');
const cors = require('cors');

// const { OAuth2Client } = require('google-auth-library');
// const oauth2Client = new OAuth2Client()

const app = express();

// Enable CORS for all routes
app.use(cors());

app.get('/status', (request, response) => {
  const status = {
    'Status': 'Running'
  };
  response.send(status);
});

app.post('/auth', async (req, res) => {
  try {
    console.log('Headers', req.headers);
    const code = req.headers.authorization;
    console.log('Authorization Code:', code);

    // Exchange the authorization code for an access token
    const googleResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: '316624811771-jugmh69v4b636shvv1c9gtj6glr5i9e7.apps.googleusercontent.com',
        client_secret: process.env.GoogleClientSecret,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code'
      }
    );
    const accessToken = googleResponse.data.access_token;
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
    // const plaidResponse = await axios.post(
    //   process.env.PlaidURL + '/link/token/create',
    //   {
    //     client_id: '65e630db59195c001ba33978',
    //     secret: process.env.PlaidSecret,
    //     client_name: 'Spearmint',
    //     language: 'en',
    //     coutry_codes: ['CA'],
    //     user: {
    //       client_user_id:userDetails
    //     }
    //   }
    // )
    console.log('Access Token:', accessToken);

    res.status(200).json({
      google_access_token: accessToken,
      // plaid_token://TODO:
    });
  } catch (error) {
    console.error('Error saving code:', error);
    res.status(500).json({ message: 'Failed to save code' });
  }
});


app.listen(process.env.PORT || 4000, () => {
  console.log('Server running on port', process.env.PORT || 4000);
});
