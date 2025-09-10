export default async (request, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    const { SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, SF_PASSWORD } = process.env;

    // Enhanced validation
    const missingVars = [];
    if (!SF_CLIENT_ID) missingVars.push('SF_CLIENT_ID');
    if (!SF_CLIENT_SECRET) missingVars.push('SF_CLIENT_SECRET');
    if (!SF_USERNAME) missingVars.push('SF_USERNAME');
    if (!SF_PASSWORD) missingVars.push('SF_PASSWORD');

    if (missingVars.length > 0) {
      throw new Error(`Missing variables: ${missingVars.join(', ')}`);
    }

    // Log detailed info for debugging
    console.log('=== CREDENTIAL ANALYSIS ===');
    console.log('Username:', SF_USERNAME);
    console.log('Password length:', SF_PASSWORD?.length);
    console.log('Password ends with letters/numbers?', /[a-zA-Z0-9]$/.test(SF_PASSWORD));
    console.log('Client ID length:', SF_CLIENT_ID?.length);
    console.log('Client ID starts with 3MVG?', SF_CLIENT_ID?.startsWith('3MVG'));
    console.log('Client Secret length:', SF_CLIENT_SECRET?.length);
    
    // Show password structure (safely)
    if (SF_PASSWORD) {
      const passwordPart = SF_PASSWORD.substring(0, SF_PASSWORD.length - 20);
      const possibleToken = SF_PASSWORD.substring(SF_PASSWORD.length - 20);
      console.log('Password part length:', passwordPart.length);
      console.log('Possible token part:', possibleToken);
    }

    const authUrl = 'https://pixelxd2-dev-ed.develop.my.salesforce.com/services/oauth2/token';
    
    console.log('Auth URL:', authUrl);
    console.log('Grant type: password');

    const authBody = new URLSearchParams({
      grant_type: 'password',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
      username: SF_USERNAME,
      password: SF_PASSWORD
    });

    console.log('Making authentication request...');

    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: authBody
    });

    const authData = await authResponse.json();

    console.log('Response status:', authResponse.status);
    console.log('Response headers:', Object.fromEntries(authResponse.headers.entries()));

    if (!authResponse.ok) {
      console.log('=== SALESFORCE ERROR DETAILS ===');
      console.log('Full error response:', JSON.stringify(authData, null, 2));
      
      let detailedError = `Salesforce auth failed (${authResponse.status})`;
      
      if (authData.error === 'invalid_grant') {
        detailedError += '\n\nPossible causes:';
        detailedError += '\n1. Wrong password + security token combination';
        detailedError += '\n2. Security token expired or not appended correctly';
        detailedError += '\n3. Username incorrect';
        detailedError += '\n4. IP restrictions in Salesforce';
      } else if (authData.error === 'invalid_client_id') {
        detailedError += '\n\nClient ID is wrong or Connected App not found';
      } else if (authData.error === 'invalid_client') {
        detailedError += '\n\nClient Secret is wrong';
      }
      
      throw new Error(detailedError);
    }

    console.log('SUCCESS! Authentication worked');
    console.log('Instance URL:', authData.instance_url);

    return new Response(JSON.stringify({
      success: true,
      access_token: authData.access_token,
      instance_url: authData.instance_url,
      token_type: authData.token_type,
      debug: 'Authentication successful!'
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('=== AUTHENTICATION ERROR ===');
    console.error('Error message:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers
    });
  }
};
