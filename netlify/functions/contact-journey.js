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
    const { contactId } = await request.json();
    
    if (!contactId) {
      throw new Error('Contact ID is required');
    }

    const authResponse = await fetch(`https://pixelxd-sfdc.netlify.app/.netlify/functions/salesforce-auth`, {
      method: 'POST'
    });
    
    const authData = await authResponse.json();
    
    if (!authData.success) {
      throw new Error(`Authentication failed: ${authData.error}`);
    }

    console.log(`Building journey for contact: ${contactId}`);

    // Get contact details (sanitize contactId)
    const cleanContactId = contactId.replace(/[^a-zA-Z0-9]/g, '');
    const contactQuery = `SELECT Id, Name, Email, Account.Name FROM Contact WHERE Id = '${cleanContactId}'`;
    const contactUrl = `${authData.instance_url}/services/data/v59.0/query/?q=${encodeURIComponent(contactQuery)}`;

    const contactResponse = await fetch(contactUrl, {
      headers: {
        'Authorization': `${authData.token_type} ${authData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const contactData = await contactResponse.json();
    
    if (contactData.totalSize === 0) {
      throw new Error('Contact not found');
    }

    const contact = contactData.records[0];

    // Get comprehensive activity data
    const queries = [
      // Tasks (calls, meetings, etc.)
      `SELECT Id, Subject, ActivityDate, Description, Type, Status, CallType FROM Task WHERE WhoId = '${cleanContactId}' ORDER BY ActivityDate ASC NULLS LAST`,
      
      // Events (meetings, calls)
      `SELECT Id, Subject, ActivityDate, Description, Type FROM Event WHERE WhoId = '${cleanContactId}' ORDER BY ActivityDate ASC NULLS LAST`,
      
      // Email Messages (if available)
      `SELECT Id, Subject, MessageDate, TextBody, Status FROM EmailMessage WHERE ToAddress LIKE '%${contact.Email}%' ORDER BY MessageDate ASC NULLS LAST LIMIT 20`
    ];

    const allActivities = [];
    
    for (const query of queries) {
      try {
        const queryUrl = `${authData.instance_url}/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;
        const response = await fetch(queryUrl, {
          headers: {
            'Authorization': `${authData.token_type} ${authData.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          allActivities.push(...data.records);
        }
      } catch (queryError) {
        console.log(`Query failed (continuing): ${queryError.message}`);
      }
    }

    // Sort all activities by date
    allActivities.sort((a, b) => {
      const dateA = new Date(a.ActivityDate || a.MessageDate || '1900-01-01');
      const dateB = new Date(b.ActivityDate || b.MessageDate || '1900-01-01');
      return dateA - dateB;
    });

    // Transform to journey events
    const journeyEvents = transformActivitiesToJourney(allActivities, contact);

    console.log(`Generated journey with ${journeyEvents.length} events`);

    return new Response(JSON.stringify({
      success: true,
      journey: {
        journeyTitle: `${contact.Name}'s Journey`,
        theme: {
          groundColor: "#f5f5f7",
          gridColor: "#cccccc", 
          skyTopColor: "#a0c3ff",
          skyBottomColor: "#f0f8ff",
          purchaseCoinColor: "#ffd700"
        },
        events: journeyEvents
      }
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Journey generation error:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers
    });
  }
};

// Enhanced activity transformation
function transformActivitiesToJourney(activities, contact) {
  const events = [];
  let xPosition = -10;

  // Add start event
  events.push({
    type: "start",
    position: [xPosition, 0, 0],
    description: "The journey begins."
  });
  xPosition += 4;

  // Enhanced mapping
  const activityTypeMap = {
    'Call': 'PHONE_CALL',
    'Email': 'EMAIL',
    'Meeting': 'MEETING',
    'Task': 'SUPPORT',
    'EmailMessage': 'EMAIL'
  };

  const sentimentMap = {
    'Completed': 'happy',
    'Closed': 'content',
    'In Progress': 'curious',
    'Not Started': 'neutral',
    'Deferred': 'concerned',
    'Sent': 'content',
    'Delivered': 'happy'
  };

  // Process activities
  activities.forEach((activity, index) => {
    let eventType = 'SUPPORT'; // default
    
    if (activity.Type) {
      eventType = activityTypeMap[activity.Type] || 'SUPPORT';
    } else if (activity.MessageDate) {
      eventType = 'EMAIL';
    }

    const sentiment = sentimentMap[activity.Status] || 'neutral';
    
    let description = activity.Subject || `${activity.Type || 'Email'} activity`;
    if (activity.Description || activity.TextBody) {
      const desc = activity.Description || activity.TextBody;
      description += ` - ${desc.substring(0, 50)}`;
    }

    const eventData = {
      'Type': activity.Type || 'Email',
      'Status': activity.Status || 'Unknown',
      'Date': formatDate(activity.ActivityDate || activity.MessageDate)
    };

    if (activity.CallType) eventData['Call Type'] = activity.CallType;

    events.push({
      type: eventType,
      position: [xPosition, 0, 0],
      eventDuration: 2.5,
      sentiment: sentiment,
      description: description,
      data: eventData
    });

    xPosition += 4;
  });

  // Add end event
  events.push({
    type: "end",
    position: [xPosition, 0, 0],
    description: "The journey continues..."
  });

  return events;
}

function formatDate(dateString) {
  if (!dateString) return 'No date';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
}

