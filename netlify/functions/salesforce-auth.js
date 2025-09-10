export default async (request, context) => {
  // Set CORS headers for browser requests
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    const { SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, SF_PASSWORD } = process.env;

    // Enhanced environment variable checking with specific missing vars
    const missingVars = [];
    if (!SF_CLIENT_ID) missingVars.push('SF_CLIENT_ID');
    if (!SF_CLIENT_SECRET) missingVars.push('SF_CLIENT_SECRET');
    if (!SF_USERNAME) missingVars.push('SF_USERNAME');
    if (!SF_PASSWORD) missingVars.push('SF_PASSWORD');

    if (missingVars.length > 0) {
      throw new Error(`Missing Salesforce environment variables: ${missingVars.join(', ')}`);
    }

    // Log some debug info (without sensitive data)
    console.log('Auth attempt:', {
      username: SF_USERNAME,
      clientIdLength: SF_CLIENT_ID?.length,
      passwordLength: SF_PASSWORD?.length,
      secretLength: SF_CLIENT_SECRET?.length
    });

    // Use your dev instance URL
    const authUrl = 'https://pixelxd2-dev-ed.develop.my.salesforce.com/services/oauth2/token';
    const authBody = new URLSearchParams({
      grant_type: 'password',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
      username: SF_USERNAME,
      password: SF_PASSWORD
    });

    console.log('Attempting Salesforce authentication...');

    // Make authentication request to Salesforce
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: authBody
    });

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      console.error('Salesforce auth error details:', {
        status: authResponse.status,
        statusText: authResponse.statusText,
        error: authData.error,
        errorDescription: authData.error_description,
        fullResponse: authData
      });
      
      // Provide more specific error messages
      let errorMessage = 'Salesforce authentication failed';
      if (authData.error === 'invalid_grant') {
        errorMessage += ': Invalid username, password, or security token. Make sure your password includes the security token at the end.';
      } else if (authData.error === 'invalid_client_id') {
        errorMessage += ': Invalid Client ID. Check your Connected App settings.';
      } else if (authData.error === 'invalid_client') {
        errorMessage += ': Invalid Client Secret. Check your Connected App settings.';
      } else {
        errorMessage += `: ${authData.error_description || authData.error}`;
      }
      
      throw new Error(errorMessage);
    }

    console.log('Salesforce authentication successful');

    // Return the access token and instance URL
    return new Response(JSON.stringify({
      success: true,
      access_token: authData.access_token,
      instance_url: authData.instance_url,
      token_type: authData.token_type
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Authentication error:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200, // Keep as 200 so the frontend can read the error details
      headers
    });
  }
};
