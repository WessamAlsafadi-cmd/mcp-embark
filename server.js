import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public folder

// Available MCP tools configuration - Updated to match GHL documentation
// Replace your AVAILABLE_TOOLS with these corrected definitions
const AVAILABLE_TOOLS = [
    {
        type: "function",
        function: {
            name: "contacts_get-contacts",
            description: "Get contacts from GHL. Can filter by various parameters.",
            parameters: {
                type: "object",
                properties: {
                    query_limit: { type: "number", description: "Limit Per Page records count. will allow maximum up to 100 and default will be 20", default: 20 },
                    query_startAfterId: { type: "string", description: "Start After Id" },
                    query_query: { type: "string", description: "Contact Query" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "contacts_get-contact",
            description: "Get a specific contact by ID",
            parameters: {
                type: "object",
                properties: {
                    path_contactId: { type: "string", description: "Contact Id" }
                },
                required: ["path_contactId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "contacts_create-contact",
            description: "Create a new contact",
            parameters: {
                type: "object",
                properties: {
                    body_firstName: { type: "string", description: "First name" },
                    body_lastName: { type: "string", description: "Last name" },
                    body_email: { type: "string", description: "Email address" },
                    body_phone: { type: "string", description: "Phone number" },
                    body_tags: { type: "array", items: { type: "string" }, description: "Tags to assign" },
                    body_locationId: { type: "string", description: "Location ID" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "contacts_add-tags",
            description: "Add tags to a contact",
            parameters: {
                type: "object",
                properties: {
                    path_contactId: { type: "string", description: "Contact Id" },
                    body_tags: { type: "array", items: { type: "string" }, description: "Tags to add" }
                },
                required: ["path_contactId", "body_tags"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "contacts_remove-tags",
            description: "Remove tags from a contact",
            parameters: {
                type: "object",
                properties: {
                    path_contactId: { type: "string", description: "Contact Id" },
                    body_tags: { type: "array", items: { type: "string" }, description: "Tags to remove" }
                },
                required: ["path_contactId", "body_tags"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "conversations_search-conversation",
            description: "Search and filter conversations",
            parameters: {
                type: "object",
                properties: {
                    query_limit: { type: "number", description: "Limit of conversations - Default is 20", default: 20 },
                    query_contactId: { type: "string", description: "Contact Id" },
                    query_locationId: { type: "string", description: "Location Id" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "conversations_get-messages",
            description: "Get messages from a conversation",
            parameters: {
                type: "object",
                properties: {
                    path_conversationId: { type: "string", description: "Conversation ID" },
                    query_limit: { type: "number", description: "Number of messages to be fetched. Default is 20", default: 20 }
                },
                required: ["path_conversationId"]
            }
        }
    },
    // 
    {
    type: "function",
    function: {
        name: "conversations_send-a-new-message",
        description: "Send a new message to a conversation. For emails, body_emailFrom is required.",
        parameters: {
            type: "object",
            properties: {
                body_type: { 
                    type: "string", 
                    description: "Message type", 
                    enum: ["SMS", "Email", "WhatsApp", "IG", "FB", "Custom", "Live_Chat"] 
                },
                body_contactId: { 
                    type: "string", 
                    description: "Contact ID" 
                },
                body_message: { 
                    type: "string", 
                    description: "Message content" 
                },
                body_subject: { 
                    type: "string", 
                    description: "Subject line for email messages" 
                },
                body_emailFrom: { 
                    type: "string", 
                    description: "Email address to send from (required for Email type)" 
                },
                body_html: { 
                    type: "string", 
                    description: "HTML content of the message (optional for emails)" 
                },
                body_emailTo: { 
                    type: "string", 
                    description: "Email address to send to, if different from contact's primary email" 
                },
                body_emailCc: { 
                    type: "array", 
                    items: { type: "string" }, 
                    description: "Array of CC email addresses" 
                },
                body_emailBcc: { 
                    type: "array", 
                    items: { type: "string" }, 
                    description: "Array of BCC email addresses" 
                },
                body_fromNumber: { 
                    type: "string", 
                    description: "Phone number used as sender for SMS/WhatsApp" 
                },
                body_toNumber: { 
                    type: "string", 
                    description: "Recipient phone number for SMS/WhatsApp" 
                }
            },
            required: ["body_type", "body_contactId"]
        }
    }
},
    {
        type: "function",
        function: {
            name: "opportunities_search-opportunity",
            description: "Search for opportunities",
            parameters: {
                type: "object",
                properties: {
                    query_limit: { type: "number", description: "Limit Per Page records count. Default is 20", default: 20 },
                    query_pipeline_id: { type: "string", description: "Pipeline Id" },
                    query_status: { type: "string", description: "Status", enum: ["open", "won", "lost", "abandoned", "all"] },
                    query_location_id: { type: "string", description: "Location Id" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "opportunities_get-pipelines",
            description: "Get all opportunity pipelines",
            parameters: {
                type: "object",
                properties: {
                    query_locationId: { type: "string", description: "Location Id" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "opportunities_update-opportunity",
            description: "Update an existing opportunity",
            parameters: {
                type: "object",
                properties: {
                    path_id: { type: "string", description: "Opportunity Id" },
                    body_pipelineId: { type: "string", description: "Pipeline Id" },
                    body_name: { type: "string", description: "Opportunity name" },
                    body_pipelineStageId: { type: "string", description: "Pipeline stage Id" },
                    body_status: { type: "string", description: "Status", enum: ["open", "won", "lost", "abandoned", "all"] },
                    body_monetaryValue: { type: "number", description: "Monetary value" },
                    body_assignedTo: { type: "string", description: "User Id to assign to" }
                },
                required: ["path_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "opportunities_get-opportunity", 
            description: "Get a specific opportunity by ID",
            parameters: {
                type: "object",
                properties: {
                    path_id: { type: "string", description: "Opportunity Id" }
                },
                required: ["path_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "locations_get-location",
            description: "Get location (sub-account) details",
            parameters: {
                type: "object",
                properties: {
                    path_locationId: { type: "string", description: "Location Id" }
                }
            }
        }
    },
    // Add these to your AVAILABLE_TOOLS array in server.js

{
    type: "function",
    function: {
        name: "calendars_get-calendars",
        description: "Get all calendars for a location",
        parameters: {
            type: "object",
            properties: {
                query_locationId: { 
                    type: "string", 
                    description: "Location Id (optional, will use default)" 
                },
                query_groupId: { 
                    type: "string", 
                    description: "Group Id to filter calendars (optional)" 
                },
                query_showDrafted: { 
                    type: "boolean", 
                    description: "Whether to show drafted calendars", 
                    default: false 
                }
            }
        }
    }
},
{
    type: "function",
    function: {
        name: "calendars_get-calendar-details",
        description: "Get specific calendar details by ID",
        parameters: {
            type: "object",
            properties: {
                path_calendarId: { 
                    type: "string", 
                    description: "Calendar ID" 
                }
            },
            required: ["path_calendarId"]
        }
    }
},
{
    type: "function",
    function: {
        name: "calendars_get-available-slots",
        description: "Get available time slots for booking appointments",
        parameters: {
            type: "object",
            properties: {
                query_calendarId: { 
                    type: "string", 
                    description: "Calendar ID" 
                },
                query_startDate: { 
                    type: "number", 
                    description: "Start date in milliseconds" 
                },
                query_endDate: { 
                    type: "number", 
                    description: "End date in milliseconds (cannot exceed 1 month from startDate)" 
                },
                query_timezone: { 
                    type: "string", 
                    description: "Timezone", 
                    default: "UTC" 
                },
                query_userId: { 
                    type: "string", 
                    description: "User ID (optional)" 
                }
            },
            required: ["query_calendarId", "query_startDate", "query_endDate"]
        }
    }
},
{
    type: "function",
    function: {
        name: "calendars_create-appointment",
        description: "Create a new appointment",
        parameters: {
            type: "object",
            properties: {
                body_calendarId: { 
                    type: "string", 
                    description: "Calendar ID" 
                },
                body_contactId: { 
                    type: "string", 
                    description: "Contact ID" 
                },
                body_startTime: { 
                    type: "string", 
                    description: "Start time in ISO format (e.g., 2021-06-23T03:30:00+05:30)" 
                },
                body_endTime: { 
                    type: "string", 
                    description: "End time in ISO format" 
                },
                body_title: { 
                    type: "string", 
                    description: "Appointment title" 
                },
                body_appointmentStatus: { 
                    type: "string", 
                    description: "Appointment status", 
                    enum: ["new", "confirmed", "cancelled", "showed", "noshow", "invalid"] 
                },
                body_assignedUserId: { 
                    type: "string", 
                    description: "Assigned user ID" 
                },
                body_meetingLocationType: { 
                    type: "string", 
                    description: "Meeting location type", 
                    enum: ["custom", "zoom", "gmeet", "phone", "address", "ms_teams", "google"] 
                },
                body_meetingLocationId: { 
                    type: "string", 
                    description: "Meeting location ID" 
                },
                body_address: { 
                    type: "string", 
                    description: "Appointment address" 
                },
                body_ignoreDateRange: { 
                    type: "boolean", 
                    description: "Ignore minimum scheduling notice and date range" 
                },
                body_toNotify: { 
                    type: "boolean", 
                    description: "Run automations (default: true)" 
                },
                body_ignoreFreeSlotValidation: { 
                    type: "boolean", 
                    description: "Ignore time slot validation" 
                }
            },
            required: ["body_calendarId", "body_contactId", "body_startTime"]
        }
    }
},
{
    type: "function",
    function: {
        name: "contacts_get-all-tasks",
        description: "Get all Tasks",
        parameters: {
            type: "object",
            properties: {
                path_contactId: { 
                    type: "string", 
                    description: "Contact Id" 
                }
            },
            required: ["path_contactId"]
        }
    }
},
{
    type: "function",
    function: {
        name: "locations_get-custom-fields",
        description: "Get Custom Fields",
        parameters: {
            type: "object",
            properties: {
                path_locationId: { 
                    type: "string", 
                    description: "Location Id" 
                },
                query_model: { 
                    type: "string", 
                    description: "Model of the custom field you want to retrieve",
                    enum: ["contact", "opportunity", "all"]
                }
            },
            required: []
        }
    }
},
{
    type: "function",
    function: {
        name: "payments_get-order-by-id",
        description: "Get order details by ID",
        parameters: {
            type: "object",
            properties: {
                path_orderId: { 
                    type: "string", 
                    description: "ID of the order that needs to be returned" 
                },
                query_locationId: { 
                    type: "string", 
                    description: "LocationId is the id of the sub-account" 
                },
                query_altId: { 
                    type: "string", 
                    description: "AltId is the unique identifier e.g: location id" 
                },
                query_altType: { 
                    type: "string", 
                    description: "AltType is the type of identifier" 
                }
            },
            required: ["path_orderId", "query_altId", "query_altType"]
        }
    }
},
{
    type: "function",
    function: {
        name: "payments_list-transactions",
        description: "List Transactions with filtering options",
        parameters: {
            type: "object",
            properties: {
                query_locationId: { 
                    type: "string", 
                    description: "LocationId is the id of the sub-account" 
                },
                query_altId: { 
                    type: "string", 
                    description: "AltId is the unique identifier e.g: location id" 
                },
                query_altType: { 
                    type: "string", 
                    description: "AltType is the type of identifier" 
                },
                query_paymentMode: { 
                    type: "string", 
                    description: "Mode of payment" 
                },
                query_startAt: { 
                    type: "string", 
                    description: "Starting interval of transactions" 
                },
                query_endAt: { 
                    type: "string", 
                    description: "Closing interval of transactions" 
                },
                query_entitySourceType: { 
                    type: "string", 
                    description: "Source of the transactions" 
                },
                query_entitySourceSubType: { 
                    type: "string", 
                    description: "Source sub-type of the transactions" 
                },
                query_search: { 
                    type: "string", 
                    description: "The name of the transaction for searching" 
                },
                query_subscriptionId: { 
                    type: "string", 
                    description: "Subscription id for filtering of transactions" 
                },
                query_entityId: { 
                    type: "string", 
                    description: "Entity id for filtering of transactions" 
                },
                query_contactId: { 
                    type: "string", 
                    description: "Contact id for filtering of transactions" 
                },
                query_limit: { 
                    type: "number", 
                    description: "The maximum number of items to be included in a single page of results",
                    default: 10
                },
                query_offset: { 
                    type: "number", 
                    description: "The starting index of the page",
                    default: 0
                }
            },
            required: ["query_altId", "query_altType"]
        }
    }
}
];
// Enhanced MCP API call function with better error handling and response parsing
async function callMCP(toolName, parameters, pitToken, locationId) {
    try {
        // Generate unique request ID
        const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        // Build proper JSON-RPC 2.0 payload
        const jsonRpcPayload = {
            jsonrpc: "2.0",
            id: requestId,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: parameters || {}
            }
        };

        // Log the request for debugging
        console.log('MCP Request (JSON-RPC 2.0):', {
            tool: toolName,
            arguments: parameters,
            locationId: locationId,
            payload: jsonRpcPayload
        });

        const response = await axios.post('https://services.leadconnectorhq.com/mcp/', jsonRpcPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pitToken}`,
                'locationId': locationId,
                'Accept': 'application/json, text/event-stream'
            },
            timeout: 30000 // 30 second timeout
        });

        console.log('MCP Raw Response:', response.status, response.data);
        
        // Handle the complex nested response structure from GHL MCP
        let parsedResult = response.data;
        
        // First level: JSON-RPC response wrapper
        if (parsedResult && parsedResult.result) {
            parsedResult = parsedResult.result;
        }
        
        // Handle event stream format (when response comes as "event: message\ndata: {...}")
        if (typeof parsedResult === 'string' && parsedResult.includes('event: message')) {
            try {
                const lines = parsedResult.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataJson = line.slice(6);
                        const dataObj = JSON.parse(dataJson);
                        if (dataObj.result) {
                            parsedResult = dataObj.result;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to parse event stream response:', e);
            }
        }
        
        // Second level: MCP content wrapper
        if (parsedResult && parsedResult.content && Array.isArray(parsedResult.content)) {
            // Extract text content from the MCP content array
            let extractedContent = '';
            for (const item of parsedResult.content) {
                if (item.type === 'text' && item.text) {
                    extractedContent += item.text;
                }
            }
            
            // Third level: Parse the extracted JSON string
            if (extractedContent.trim().startsWith('{') || extractedContent.trim().startsWith('[')) {
                try {
                    const finalResult = JSON.parse(extractedContent);
                    
                    // FIXED: Better error detection for GHL API responses
                    if (finalResult.success === false || 
                        (finalResult.status && finalResult.status >= 400) ||
                        (finalResult.data && finalResult.data.error)) {
                        
                        const errorMsg = finalResult.data?.error || 
                                       finalResult.error || 
                                       `API Error (Status: ${finalResult.status})`;
                        throw new Error(`GHL API Error: ${errorMsg}`);
                    }
                    
                    parsedResult = finalResult;
                    
                } catch (parseError) {
                    // If it's our custom error, re-throw it
                    if (parseError.message.startsWith('GHL API Error:')) {
                        throw parseError;
                    }
                    
                    console.error('Failed to parse extracted JSON:', parseError);
                    console.error('Raw extracted content:', extractedContent);
                    throw new Error(`Failed to parse MCP response: ${parseError.message}`);
                }
            } else {
                parsedResult = { text: extractedContent };
            }
        }
        
        // Handle JSON-RPC protocol errors
        if (response.data && response.data.error) {
            throw new Error(`JSON-RPC Error: ${response.data.error.message} (Code: ${response.data.error.code})`);
        }
        
        console.log('MCP Parsed Result:', parsedResult);
        return parsedResult;
        
    } catch (error) {
        console.error(`MCP call error for ${toolName}:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers,
            message: error.message
        });
        
        // Create detailed error message
        let errorMessage = `MCP call failed: ${error.message}`;
        if (error.response?.status) {
            errorMessage = `MCP call failed with status ${error.response.status}: ${error.response.statusText}`;
            if (error.response.data) {
                errorMessage += `. Details: ${JSON.stringify(error.response.data)}`;
            }
        }
        
        throw new Error(errorMessage);
    }
}
// Groq API call function using official SDK - FIXED MODEL
async function callGroq(messages, tools, groqApiKey, stream = false) {
    try {
        const groq = new Groq({ apiKey: groqApiKey });
        
        const payload = {
            messages: messages,
            model: "meta-llama/llama-4-maverick-17b-128e-instruct", // FIXED: Updated to active model
            temperature: 0.6,
            max_completion_tokens: 4096,
            top_p: 1,
            stream: stream
        };

        if (tools && tools.length > 0) {
            payload.tools = tools;
            payload.tool_choice = "auto";
        }

        const chatCompletion = await groq.chat.completions.create(payload);
        return chatCompletion;
        
    } catch (error) {
        console.error('Groq SDK error:', error.message);
        throw new Error(`Groq API call failed: ${error.message}`);
    }
}

// Add these helper functions to your server.js for calendar operations

// Helper functions for calendar date conversions
function getTodayTimestamps() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);
    
    return {
        start: startOfDay.getTime().toString(),
        end: endOfDay.getTime().toString()
    };
}

function getCurrentWeekTimestamps() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    return {
        start: startOfWeek.getTime().toString(),
        end: endOfWeek.getTime().toString()
    };
}

function getDateRangeTimestamps(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return {
        start: start.getTime().toString(),
        end: end.getTime().toString()
    };
}

// Update your addDefaultParameters function to include calendar defaults
// Add this to your existing addDefaultParameters function:

// Add these validation functions to your server.js

// Validation rules for each tool
const TOOL_VALIDATION_RULES = {
    'contacts_create-contact': {
        required: ['body_firstName', 'body_lastName'],
        oneRequired: [['body_email', 'body_phone']], // At least one of these
        confirmationMessage: "I'll create a new contact with the provided information."
    },
    'contacts_add-tags': {
        required: ['path_contactId', 'body_tags'],
        confirmationMessage: "I'll add the specified tags to this contact."
    },
    'contacts_remove-tags-workaround': {
        required: ['path_contactId', 'body_tags'],
        confirmationMessage: "I'll remove the specified tags from this contact."
    },
    'conversations_send-a-new-message': {
        required: ['body_contactId', 'body_type'],
        conditional: {
            'body_type': {
                'Email': ['body_subject', 'body_message', 'body_emailFrom'],
                'SMS': ['body_message'],
                'WhatsApp': ['body_message']
            }
        },
        confirmationMessage: "I'll send the message to this contact."
    },
    'opportunities_update-opportunity': {
        required: ['path_id'],
        confirmationMessage: "I'll update this opportunity with the new information."
    },
    // Add these to your TOOL_VALIDATION_RULES object

'calendars_get-calendars': {
    required: [],
    confirmationMessage: "I'll get all available calendars for your location."
},
'calendars_get-calendar-details': {
    required: ['path_calendarId'],
    confirmationMessage: "I'll get the details for this calendar."
},
'calendars_get-available-slots': {
    required: ['query_calendarId', 'query_startDate', 'query_endDate'],
    confirmationMessage: "I'll check available time slots for this calendar."
},
'calendars_create-appointment': {
    required: ['body_calendarId', 'body_contactId', 'body_startTime'],
    confirmationMessage: "I'll create a new appointment with the provided details."
},
'contacts_get-all-tasks': {
    required: ['path_contactId'],
    confirmationMessage: "I'll get all tasks for this contact."
},
'locations_get-custom-fields': {
    required: [],
    confirmationMessage: "I'll retrieve the custom field definitions."
},
'payments_get-order-by-id': {
    required: ['path_orderId', 'query_altId', 'query_altType'],
    confirmationMessage: "I'll retrieve the order details."
},
'payments_list-transactions': {
    required: ['query_altId', 'query_altType'],
    confirmationMessage: "I'll list transactions based on your criteria."
}
};

// Validate tool parameters before execution
function validateToolParameters(toolName, args) {
    const rules = TOOL_VALIDATION_RULES[toolName];
    if (!rules) return { valid: true };

    const missing = [];
    const errors = [];

    // Check required parameters
    if (rules.required) {
        for (const param of rules.required) {
            if (!args[param] || (Array.isArray(args[param]) && args[param].length === 0)) {
                missing.push(param);
            }
        }
    }

    // Check one-required parameters (at least one must be present)
    if (rules.oneRequired) {
        for (const group of rules.oneRequired) {
            const hasOne = group.some(param => args[param] && args[param].trim() !== '');
            if (!hasOne) {
                errors.push(`At least one of these is required: ${group.join(', ')}`);
            }
        }
    }

    // Check conditional requirements
    if (rules.conditional) {
        for (const [conditionParam, conditions] of Object.entries(rules.conditional)) {
            const conditionValue = args[conditionParam];
            if (conditionValue && conditions[conditionValue]) {
                for (const requiredParam of conditions[conditionValue]) {
                    if (!args[requiredParam]) {
                        missing.push(`${requiredParam} (required for ${conditionParam}=${conditionValue})`);
                    }
                }
            }
        }
    }

    return {
        valid: missing.length === 0 && errors.length === 0,
        missing,
        errors,
        confirmationMessage: rules.confirmationMessage
    };
}

// Add default values for common parameters
function addDefaultParameters(toolName, args, pitToken, locationId) {
    const updatedArgs = { ...args };

    // Add default emailFrom for emails
    if (toolName === 'conversations_send-a-new-message' && args.body_type === 'Email') {
        if (!updatedArgs.body_emailFrom) {
            updatedArgs.body_emailFrom = process.env.DEFAULT_EMAIL_FROM || 'noreply@yourcompany.com';
        }
    }

    // Add locationId for contact creation
    if (toolName === 'contacts_create-contact' && !updatedArgs.body_locationId) {
        updatedArgs.body_locationId = locationId;
    }
    if (toolName === 'calendars_get-calendar-events') {
    // Add default location ID if not provided
    if (!updatedArgs.query_locationId) {
        updatedArgs.query_locationId = locationId;
    }
}

if (toolName === 'calendars_get-appointment-notes') {
    // Set default limit and offset if not provided
    if (!updatedArgs.query_limit) {
        updatedArgs.query_limit = 10;
    }
    if (!updatedArgs.query_offset) {
        updatedArgs.query_offset = 0;
    }
}

if (toolName === 'locations_get-custom-fields') {
    // Add default location ID if not provided
    if (!updatedArgs.path_locationId) {
        updatedArgs.path_locationId = locationId;
    }
}

if (toolName === 'payments_list-transactions') {
    // Set default limit and offset if not provided
    if (!updatedArgs.query_limit) {
        updatedArgs.query_limit = 10;
    }
    if (!updatedArgs.query_offset) {
        updatedArgs.query_offset = 0;
    }
    // Add location as altId if not provided
    if (!updatedArgs.query_altId) {
        updatedArgs.query_altId = locationId;
    }
    if (!updatedArgs.query_altType) {
        updatedArgs.query_altType = 'location';
    }
}


    return updatedArgs;
}

// Enhanced error handling with user-friendly messages
function formatUserFriendlyError(error, toolName, args) {
    if (error.message.includes('Contact with id') && error.message.includes('not found')) {
        return "I couldn't find that contact. Let me search for them first and try again.";
    }
    
    if (error.message.includes('There is no message or attachments')) {
        return "The message couldn't be sent. Please make sure you've provided the message content and all required information.";
    }
    
    if (error.message.includes('tool calling') && error.message.includes('not supported')) {
        return "I'm having trouble with that request. Let me try a different approach.";
    }
    
    // Generic user-friendly error
    return "I encountered an issue while trying to complete that action. Let me try again or suggest an alternative approach.";
}

// Add this comprehensive MCP testing suite to your server.js
async function testAllMCPTools(pitToken, locationId) {
    const testResults = {
        passed: [],
        failed: [],
        summary: {}
    };

    console.log('=== COMPREHENSIVE MCP TOOL TESTING ===\n');

    // Test 1: Get Location (should always work)
    try {
        console.log('1. Testing locations_get-location...');
        const locationResult = await callMCP('locations_get-location', {}, pitToken, locationId);
        console.log('✅ Location test passed');
        console.log('Response structure:', Object.keys(locationResult));
        testResults.passed.push('locations_get-location');
    } catch (error) {
        console.log('❌ Location test failed:', error.message);
        testResults.failed.push('locations_get-location');
    }

    // Test 2: Get Contacts (basic functionality)
    let testContactId = null;
    try {
        console.log('\n2. Testing contacts_get-contacts...');
        const contactsResult = await callMCP('contacts_get-contacts', { limit: 5 }, pitToken, locationId);
        console.log('✅ Get contacts test passed');
        console.log('Response structure:', Object.keys(contactsResult));
        console.log('Number of contacts returned:', contactsResult.data?.length || 0);
        
        if (contactsResult.data && contactsResult.data.length > 0) {
            testContactId = contactsResult.data[0].id;
            console.log('Test contact ID for further testing:', testContactId);
        }
        testResults.passed.push('contacts_get-contacts');
    } catch (error) {
        console.log('❌ Get contacts test failed:', error.message);
        testResults.failed.push('contacts_get-contacts');
    }

    // Test 3: Get Specific Contact (if we have an ID)
    if (testContactId) {
        try {
            console.log('\n3. Testing contacts_get-contact...');
            const specificContactResult = await callMCP('contacts_get-contact', { 
                contactId: testContactId 
            }, pitToken, locationId);
            console.log('✅ Get specific contact test passed');
            console.log('Response structure:', Object.keys(specificContactResult));
            testResults.passed.push('contacts_get-contact');
        } catch (error) {
            console.log('❌ Get specific contact test failed:', error.message);
            testResults.failed.push('contacts_get-contact');
        }
    }

    // Test 4: Add Tags (the problematic one)
    if (testContactId) {
        try {
            console.log('\n4. Testing contacts_add-tags...');
            const addTagsResult = await callMCP('contacts_add-tags', {
                contactId: testContactId,
                tags: ['mcp-test-tag']
            }, pitToken, locationId);
            console.log('✅ Add tags test passed');
            console.log('Response structure:', Object.keys(addTagsResult));
            testResults.passed.push('contacts_add-tags');
        } catch (error) {
            console.log('❌ Add tags test failed:', error.message);
            console.log('Full error details:', error);
            testResults.failed.push('contacts_add-tags');
        }
    }

    // Test 5: Remove Tags
    if (testContactId) {
        try {
            console.log('\n5. Testing contacts_remove-tags...');
            const removeTagsResult = await callMCP('contacts_remove-tags', {
                contactId: testContactId,
                tags: ['mcp-test-tag']
            }, pitToken, locationId);
            console.log('✅ Remove tags test passed');
            console.log('Response structure:', Object.keys(removeTagsResult));
            testResults.passed.push('contacts_remove-tags');
        } catch (error) {
            console.log('❌ Remove tags test failed:', error.message);
            testResults.failed.push('contacts_remove-tags');
        }
    }

    // Test 6: Create Contact
    try {
        console.log('\n6. Testing contacts_create-contact...');
        const createContactResult = await callMCP('contacts_create-contact', {
            firstName: 'MCP',
            lastName: 'Test',
            email: `mcptest${Date.now()}@example.com`,
            tags: ['mcp-created']
        }, pitToken, locationId);
        console.log('✅ Create contact test passed');
        console.log('Response structure:', Object.keys(createContactResult));
        testResults.passed.push('contacts_create-contact');
    } catch (error) {
        console.log('❌ Create contact test failed:', error.message);
        testResults.failed.push('contacts_create-contact');
    }

    // Test 7: Search Conversations
    try {
        console.log('\n7. Testing conversations_search-conversation...');
        const conversationsResult = await callMCP('conversations_search-conversation', { 
            limit: 5 
        }, pitToken, locationId);
        console.log('✅ Search conversations test passed');
        console.log('Response structure:', Object.keys(conversationsResult));
        console.log('Number of conversations:', conversationsResult.data?.length || 0);
        testResults.passed.push('conversations_search-conversation');
    } catch (error) {
        console.log('❌ Search conversations test failed:', error.message);
        testResults.failed.push('conversations_search-conversation');
    }

    // Test 8: Get Opportunities
    try {
        console.log('\n8. Testing opportunities_search-opportunity...');
        const opportunitiesResult = await callMCP('opportunities_search-opportunity', { 
            limit: 5 
        }, pitToken, locationId);
        console.log('✅ Search opportunities test passed');
        console.log('Response structure:', Object.keys(opportunitiesResult));
        console.log('Number of opportunities:', opportunitiesResult.data?.length || 0);
        testResults.passed.push('opportunities_search-opportunity');
    } catch (error) {
        console.log('❌ Search opportunities test failed:', error.message);
        testResults.failed.push('opportunities_search-opportunity');
    }

    // Test 9: Get Pipelines
    try {
        console.log('\n9. Testing opportunities_get-pipelines...');
        const pipelinesResult = await callMCP('opportunities_get-pipelines', {}, pitToken, locationId);
        console.log('✅ Get pipelines test passed');
        console.log('Response structure:', Object.keys(pipelinesResult));
        testResults.passed.push('opportunities_get-pipelines');
    } catch (error) {
        console.log('❌ Get pipelines test failed:', error.message);
        testResults.failed.push('opportunities_get-pipelines');
    }

    // Test Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`✅ Passed: ${testResults.passed.length}`);
    console.log(`❌ Failed: ${testResults.failed.length}`);
    console.log('\nPassed tools:', testResults.passed);
    console.log('Failed tools:', testResults.failed);

    testResults.summary = {
        totalTests: testResults.passed.length + testResults.failed.length,
        passedCount: testResults.passed.length,
        failedCount: testResults.failed.length,
        successRate: `${Math.round((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100)}%`
    };

    return testResults;
}



// Add endpoint to run the comprehensive test
app.post('/api/test-all-mcp', async (req, res) => {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        const locationId = process.env.GHL_LOCATION_ID;
        
        const results = await testAllMCPTools(pitToken, locationId);
        
        res.json({ 
            success: true, 
            message: 'Comprehensive MCP testing completed',
            results: results
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
//////////////////////////////////////////////////////////// test functions
// Add a specific test for the contact ID extraction issue
async function testContactIdExtraction(pitToken, locationId) {
    console.log('=== TESTING CONTACT ID EXTRACTION ===\n');
    
    try {
        // Get a contact
        const contactsResult = await callMCP('contacts_get-contacts', { 
            limit: 1 
        }, pitToken, locationId);
        
        console.log('Raw MCP response:');
        console.log(JSON.stringify(contactsResult, null, 2));
        
        console.log('\nTesting ID extraction paths:');
        
        // Test different possible paths to the contact ID
        const paths = [
            'contactsResult.data[0].id',
            'contactsResult.data[0].contactId', 
            'contactsResult.contacts[0].id',
            'contactsResult[0].id'
        ];
        
        for (const path of paths) {
            try {
                const value = eval(path);
                console.log(`${path}: ${value} (type: ${typeof value})`);
            } catch (e) {
                console.log(`${path}: undefined/error`);
            }
        }
        
    } catch (error) {
        console.log('Contact ID extraction test failed:', error.message);
    }
}

// Add this to discover what tools are actually available in the MCP server
async function discoverMCPTools(pitToken, locationId) {
    try {
        console.log('=== DISCOVERING AVAILABLE MCP TOOLS ===');
        
        // Try to call the MCP server's tools/list endpoint
        const toolsListPayload = {
            jsonrpc: "2.0",
            id: Date.now().toString(),
            method: "tools/list"
        };

        const response = await axios.post('https://services.leadconnectorhq.com/mcp/', toolsListPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pitToken}`,
                'locationId': locationId,
                'Accept': 'application/json, text/event-stream'
            },
            timeout: 30000
        });

        console.log('Available tools from MCP server:');
        console.log(JSON.stringify(response.data, null, 2));
        
        return response.data;
        
    } catch (error) {
        console.error('Failed to discover MCP tools:', error.message);
        
        // Fallback: Try different variations of tag tools
        console.log('\nTrying alternative tag tool names...');
        
        const alternativeTools = [
            'contact_add-tags',
            'contacts_add-tag', 
            'contacts_tags_add',
            'contacts_update-tags',
            'ghl_contacts_add-tags',
            'leadconnector_contacts_add-tags'
        ];
        
        for (const toolName of alternativeTools) {
            try {
                console.log(`Testing tool: ${toolName}`);
                // Don't actually call it, just test if it exists by sending invalid params
                // and seeing if we get a "tool not found" vs "invalid params" error
            } catch (e) {
                console.log(`${toolName}: ${e.message}`);
            }
        }
        
        return null;
    }
}

// Add endpoint to discover tools
app.post('/api/discover-mcp-tools', async (req, res) => {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        const locationId = process.env.GHL_LOCATION_ID;
        
        const tools = await discoverMCPTools(pitToken, locationId);
        
        res.json({ 
            success: true, 
            tools: tools,
            message: 'Tool discovery completed - check console for details'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test different parameter combinations for MCP tagging
async function testMCPTaggingVariations(contactId, pitToken, locationId) {
    console.log('=== TESTING MCP TAGGING VARIATIONS ===');
    console.log('Using contact ID:', contactId);
    
    const variations = [
        // Standard format
        {
            name: 'contacts_add-tags',
            params: { contactId: contactId, tags: ['test-tag-1'] }
        },
        // Try with version parameter
        {
            name: 'contacts_add-tags',
            params: { contactId: contactId, tags: ['test-tag-2'], version: '2021-07-28' }
        },
        // Try with different parameter structure
        {
            name: 'contacts_add-tags',
            params: { contact_id: contactId, tags: ['test-tag-3'] }
        },
        // Try with locationId in params
        {
            name: 'contacts_add-tags',
            params: { contactId: contactId, tags: ['test-tag-4'], locationId: locationId }
        }
    ];
    
    for (let i = 0; i < variations.length; i++) {
        const variation = variations[i];
        console.log(`\nTesting variation ${i + 1}: ${variation.name}`);
        console.log('Parameters:', JSON.stringify(variation.params, null, 2));
        
        try {
            const result = await callMCP(variation.name, variation.params, pitToken, locationId);
            console.log(`✅ Variation ${i + 1} succeeded:`, result);
        } catch (error) {
            console.log(`❌ Variation ${i + 1} failed:`, error.message);
        }
    }
}

// Add endpoint to test variations
app.post('/api/test-mcp-tagging-variations', async (req, res) => {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        const locationId = process.env.GHL_LOCATION_ID;
        const { contactId } = req.body;
        
        if (!contactId) {
            return res.status(400).json({ 
                success: false, 
                error: 'contactId is required in request body' 
            });
        }
        
        await testMCPTaggingVariations(contactId, pitToken, locationId);
        
        res.json({ 
            success: true, 
            message: 'MCP tagging variations test completed - check console'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
//////////////////////////////////////////////////////////////// test functions
app.post('/api/test-contact-id-extraction', async (req, res) => {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        const locationId = process.env.GHL_LOCATION_ID;
        
        await testContactIdExtraction(pitToken, locationId);
        
        res.json({ success: true, message: 'Contact ID extraction test completed - check console' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all calendars for a location
 * @param {string} locationId - The location ID (optional, will use env default)
 * @param {string} groupId - The group ID (optional)
 * @param {boolean} showDrafted - Whether to show drafted calendars (optional, default: false)
 * @returns {Promise<Object>} - Calendar list response
 */
async function getCalendars(locationId = null, groupId = null, showDrafted = false) {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        const defaultLocationId = process.env.GHL_LOCATION_ID;
        
        // Use provided locationId or default from env
        const targetLocationId = locationId || defaultLocationId;
        
        if (!pitToken) {
            throw new Error('GHL_PIT_TOKEN is required in environment variables');
        }
        
        if (!targetLocationId) {
            throw new Error('locationId is required either as parameter or GHL_LOCATION_ID in environment');
        }

        // Build query parameters
        const queryParams = new URLSearchParams({
            locationId: targetLocationId,
            showDrafted: showDrafted.toString()
        });

        // Add groupId only if provided
        if (groupId) {
            queryParams.append('groupId', groupId);
        }

        const url = `https://services.leadconnectorhq.com/calendars/?${queryParams.toString()}`;
        
        console.log('Getting calendars from URL:', url);

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${pitToken}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('Calendars retrieved successfully:', response.data);
        return response.data;

    } catch (error) {
        console.error('Error getting calendars:', error.response?.data || error.message);
        
        // Provide user-friendly error messages
        if (error.response?.status === 401) {
            throw new Error('Authentication failed. Please check your PIT token.');
        }
        
        if (error.response?.status === 404) {
            throw new Error('Location not found. Please check the location ID.');
        }
        
        if (error.response?.status === 403) {
            throw new Error('Access denied. Please check your permissions for this location.');
        }
        
        // Re-throw with original message if no specific handling
        throw new Error(`Failed to get calendars: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Get a specific calendar by ID
 * @param {string} calendarId - The calendar ID (required)
 * @returns {Promise<Object>} - Calendar details response
 */
async function getCalendar(calendarId) {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        
        if (!pitToken) {
            throw new Error('GHL_PIT_TOKEN is required in environment variables');
        }
        
        if (!calendarId) {
            throw new Error('calendarId is required');
        }

        const url = `https://services.leadconnectorhq.com/calendars/${calendarId}`;
        
        console.log('Getting calendar details for ID:', calendarId);

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${pitToken}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('Calendar details retrieved successfully:', response.data);
        return response.data;

    } catch (error) {
        console.error('Error getting calendar:', error.response?.data || error.message);
        
        // Provide user-friendly error messages
        if (error.response?.status === 401) {
            throw new Error('Authentication failed. Please check your PIT token.');
        }
        
        if (error.response?.status === 404) {
            throw new Error('Calendar not found. Please check the calendar ID.');
        }
        
        if (error.response?.status === 403) {
            throw new Error('Access denied. You may not have permission to view this calendar.');
        }
        
        // Re-throw with original message if no specific handling
        throw new Error(`Failed to get calendar: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Get available time slots for a calendar
 * @param {string} calendarId - The calendar ID (required)
 * @param {number} startDate - Start date in milliseconds (required)
 * @param {number} endDate - End date in milliseconds (required, cannot exceed 1 month from startDate)
 * @param {string} timezone - Timezone (optional, defaults to UTC)
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Object>} - Available slots response
 */
async function getFreeSlots(calendarId, startDate, endDate, timezone = 'UTC', userId = null) {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        
        if (!pitToken) {
            throw new Error('GHL_PIT_TOKEN is required in environment variables');
        }
        
        if (!calendarId) {
            throw new Error('calendarId is required');
        }
        
        if (!startDate) {
            throw new Error('startDate is required');
        }
        
        if (!endDate) {
            throw new Error('endDate is required');
        }

        // Validate date range (cannot exceed 1 month)
        const oneMonthInMs = 31 * 24 * 60 * 60 * 1000; // 31 days in milliseconds
        if (endDate - startDate > oneMonthInMs) {
            throw new Error('Date range cannot exceed 1 month');
        }

        // Build query parameters
        const queryParams = new URLSearchParams({
            calendarId: calendarId,
            startDate: startDate.toString(),
            endDate: endDate.toString(),
            timezone: timezone
        });

        // Add userId only if provided
        if (userId) {
            queryParams.append('userId', userId);
        }

        const url = `https://services.leadconnectorhq.com/calendars/slots?${queryParams.toString()}`;
        
        console.log('Getting free slots with params:', {
            calendarId,
            startDate,
            endDate,
            timezone,
            userId
        });

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${pitToken}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('Free slots retrieved successfully:', response.data);
        return response.data;

    } catch (error) {
        console.error('Error getting free slots:', error.response?.data || error.message);
        
        // Provide user-friendly error messages
        if (error.response?.status === 401) {
            throw new Error('Authentication failed. Please check your PIT token.');
        }
        
        if (error.response?.status === 404) {
            throw new Error('Calendar not found. Please check the calendar ID.');
        }
        
        if (error.response?.status === 403) {
            throw new Error('Access denied. You may not have permission to view this calendar.');
        }
        
        if (error.response?.status === 400) {
            throw new Error('Invalid request parameters. Please check the date range and calendar ID.');
        }
        
        // Re-throw with original message if no specific handling
        throw new Error(`Failed to get free slots: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Create a new appointment
 * @param {Object} appointmentData - Appointment data object
 * @param {string} appointmentData.calendarId - Calendar ID (required)
 * @param {string} appointmentData.contactId - Contact ID (required)
 * @param {string} appointmentData.startTime - Start time in ISO format (required)
 * @param {string} appointmentData.title - Appointment title
 * @param {string} appointmentData.endTime - End time in ISO format
 * @param {string} appointmentData.appointmentStatus - Status (new, confirmed, cancelled, showed, noshow, invalid)
 * @param {string} appointmentData.assignedUserId - Assigned user ID
 * @param {string} appointmentData.meetingLocationType - Meeting location type (custom, zoom, gmeet, phone, address, ms_teams, google)
 * @param {string} appointmentData.meetingLocationId - Meeting location ID
 * @param {boolean} appointmentData.overrideLocationConfig - Override location config
 * @param {string} appointmentData.address - Appointment address
 * @param {boolean} appointmentData.ignoreDateRange - Ignore minimum scheduling notice and date range
 * @param {boolean} appointmentData.toNotify - Run automations (default: true)
 * @param {boolean} appointmentData.ignoreFreeSlotValidation - Ignore time slot validation
 * @param {string} appointmentData.rrule - RRULE for recurring events
 * @param {string} appointmentData.locationId - Location ID (optional, will use env default)
 * @returns {Promise<Object>} - Created appointment response
 */
async function createAppointment(appointmentData) {
    try {
        const pitToken = process.env.GHL_PIT_TOKEN;
        const defaultLocationId = process.env.GHL_LOCATION_ID;
        
        if (!pitToken) {
            throw new Error('GHL_PIT_TOKEN is required in environment variables');
        }
        
        // Validate required fields
        if (!appointmentData.calendarId) {
            throw new Error('calendarId is required');
        }
        
        if (!appointmentData.contactId) {
            throw new Error('contactId is required');
        }
        
        if (!appointmentData.startTime) {
            throw new Error('startTime is required');
        }

        // Use provided locationId or default from env
        const locationId = appointmentData.locationId || defaultLocationId;
        if (!locationId) {
            throw new Error('locationId is required either in appointmentData or GHL_LOCATION_ID in environment');
        }

        // Build request body with defaults
        const requestBody = {
            calendarId: appointmentData.calendarId,
            locationId: locationId,
            contactId: appointmentData.contactId,
            startTime: appointmentData.startTime,
            title: appointmentData.title || 'New Appointment',
            endTime: appointmentData.endTime,
            appointmentStatus: appointmentData.appointmentStatus || 'new',
            assignedUserId: appointmentData.assignedUserId,
            meetingLocationType: appointmentData.meetingLocationType || 'custom',
            meetingLocationId: appointmentData.meetingLocationId || 'default',
            overrideLocationConfig: appointmentData.overrideLocationConfig || false,
            address: appointmentData.address,
            ignoreDateRange: appointmentData.ignoreDateRange || false,
            toNotify: appointmentData.toNotify !== false, // Default to true unless explicitly set to false
            ignoreFreeSlotValidation: appointmentData.ignoreFreeSlotValidation || false,
            rrule: appointmentData.rrule
        };

        // Remove undefined values to avoid API issues
        Object.keys(requestBody).forEach(key => {
            if (requestBody[key] === undefined) {
                delete requestBody[key];
            }
        });

        const url = 'https://services.leadconnectorhq.com/calendars/events/appointments';
        
        console.log('Creating appointment with data:', requestBody);

        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': `Bearer ${pitToken}`,
                'Version': '2021-04-15',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('Appointment created successfully:', response.data);
        return response.data;

    } catch (error) {
        console.error('Error creating appointment:', error.response?.data || error.message);
        
        // Provide user-friendly error messages
        if (error.response?.status === 401) {
            throw new Error('Authentication failed. Please check your PIT token.');
        }
        
        if (error.response?.status === 404) {
            throw new Error('Calendar or contact not found. Please check the calendar ID and contact ID.');
        }
        
        if (error.response?.status === 403) {
            throw new Error('Access denied. You may not have permission to create appointments on this calendar.');
        }
        
        if (error.response?.status === 400) {
            const errorMessage = error.response?.data?.message || 'Invalid request parameters';
            throw new Error(`Bad request: ${errorMessage}`);
        }
        
        if (error.response?.status === 409) {
            throw new Error('Time slot conflict. The selected time slot may already be booked.');
        }
        
        // Re-throw with original message if no specific handling
        throw new Error(`Failed to create appointment: ${error.response?.data?.message || error.message}`);
    }
}
// Main chat endpoint
// Main chat endpoint - Enhanced with validation
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;

        // Get credentials from environment variables
        const groqApiKey = process.env.GROQ_API_KEY;
        const pitToken = process.env.GHL_PIT_TOKEN;
        const locationId = process.env.GHL_LOCATION_ID;

        // Validation
        if (!message) {
            return res.status(400).json({ 
                error: 'Missing required field: message' 
            });
        }

        if (!groqApiKey || !pitToken || !locationId) {
            return res.status(500).json({ 
                error: 'Server configuration error: Missing API credentials in environment variables' 
            });
        }

        // Build system message with enhanced user-friendly instructions
        const systemMessage = {
            role: "system",
            content: `You are a helpful Embark+ CRM assistant. You help users manage their contacts, opportunities, conversations, calendar events, and other CRM tasks in a friendly, conversational way.

CRITICAL INTERACTION RULES:
1. NEVER show technical details, JSON, or error messages to users
2. NEVER write Python code, JavaScript code, or any programming code
3. NEVER try to calculate timestamps manually or show code examples
4. ALWAYS use the available MCP tools directly - you are NOT a programmer
5. ALWAYS ask for missing information before attempting any action
6. ALWAYS ask for user confirmation before performing actions that modify data
7. Speak conversationally, not technically

YOU ARE A CRM ASSISTANT, NOT A PROGRAMMER:
- Use the available calendar tools directly
- Do not write code to calculate dates or timestamps
- Do not show programming examples to users
- Simply call the appropriate MCP tools with the right parameters

BEFORE TAKING ACTIONS:
- For creating contacts: Ask for name (first/last), phone OR email (at least one required)
- For tagging contacts: Ask which contact and which tags to add/remove
- For sending messages: Ask for recipient, message type (SMS/Email), message content
- For sending emails: Also ask for subject line and confirm sender email
- For updating opportunities: Ask which opportunity and what changes to make
- For calendar events: Need start/end time and MUST have either userId, calendarId, or groupId
- For appointment notes: Need the specific appointment ID from calendar events
- For any destructive actions: Get explicit confirmation

CALENDAR OPERATIONS - CRITICAL RULES:
- Get calendar events: REQUIRES start time, end time, AND either userId, calendarId, or groupId
- You MUST ask users which calendar/user they want to check if not specified
- Convert natural language dates ("today", "September 9th") to millisecond timestamps
- Appointment notes: Requires specific appointment ID from calendar events
- NEVER write code to calculate timestamps - use the tools directly

CALENDAR WORKFLOW:
1. When user asks for calendar events, ask: "Which user's calendar would you like me to check?"
2. Convert their date request to proper timestamp format internally
3. Call appropriate calendar tools with proper parameters
4. Display events in user-friendly format
5. If they want appointment notes, extract appointment IDs from the events and ask which appointment

DATE CONVERSION RULES:
- Today: Use current date start/end timestamps
- "September 9th" or "September 9th 2025": Convert to that date's start/end timestamps
- Always assume current year if not specified
- Convert dates to millisecond timestamps for the API calls

MESSAGING REQUIREMENTS:
- SMS: Needs contact and message content
- Email: Needs contact, subject line, message content, and uses default sender email
- Always confirm message type and recipient before sending

OTHER CAPABILITIES:
- Tasks: Can retrieve all tasks for a contact
- Custom Fields: Can get field definitions for contacts/opportunities  
- Payments: Can view orders and list transactions
- Calendar management: Get calendars, check availability, create appointments
- All operations maintain user-friendly interactions

RESPONSE STYLE:
- Be conversational and helpful
- Ask one question at a time when gathering information
- Confirm actions before executing: "I'll get your calendar events for September 9th. Should I proceed?"
- Report results in plain language: "Found 3 appointments on September 9th!" not technical details
- If something fails, explain what happened in simple terms and suggest alternatives
- NEVER show code, timestamps, or technical calculations to users

PARAMETER REQUIREMENTS:
- Path parameters: path_contactId, path_id, path_appointmentId, etc.
- Body parameters: body_tags, body_message, body_emailFrom, etc.  
- Query parameters: query_limit, query_query, query_startTime, query_endTime, etc.

CALENDAR PARAMETER REQUIREMENTS:
- query_startTime and query_endTime: ALWAYS required (millisecond timestamps)
- ONE of these is REQUIRED: query_userId, query_calendarId, or query_groupId
- query_locationId: Will be provided automatically

For emails, always use body_emailFrom with a default sender email when not specified.
For calendar events, you must ask for user/calendar identification if not provided.

WHAT YOU CANNOT DO:
- Write any programming code
- Calculate timestamps manually  
- Show users technical details
- Access calendars without proper user/calendar identification

Remember: You're helping busy professionals manage their CRM efficiently. Keep it simple, clear, conversational, and always ask before acting. You are a CRM assistant using tools, not a programmer writing code.

Location ID: ${locationId}`
        };

        // Build conversation history
        const messages = [systemMessage, ...(conversationHistory || []), { role: "user", content: message }];

        // First call to Groq to see if tools are needed
        const response = await callGroq(messages, AVAILABLE_TOOLS, groqApiKey, false);
        const assistantMessage = response.choices[0].message;
        // Add this right before "Execute the validated tool call"

        let toolResults = [];
        console.log('🔍 DEBUG: About to execute tool:', toolName);
console.log('🔍 DEBUG: Calendar functions available:', {
    getCalendars: typeof getCalendars,
    getCalendar: typeof getCalendar,
    getFreeSlots: typeof getFreeSlots,
    createAppointment: typeof createAppointment
});
        let updatedConversationHistory = [...(conversationHistory || []), { role: "user", content: message }];

        // Handle tool calls if any - ENHANCED WITH VALIDATION
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            updatedConversationHistory.push(assistantMessage);

            for (const toolCall of assistantMessage.tool_calls) {
                const toolName = toolCall.function.name;
                let toolArgs = JSON.parse(toolCall.function.arguments);
                
                try {
                    // Add default parameters
                    toolArgs = addDefaultParameters(toolName, toolArgs, pitToken, locationId);
                    
                    // Validate parameters
                    const validation = validateToolParameters(toolName, toolArgs);
                    
                    if (!validation.valid) {
                        // Create a user-friendly error message instead of calling the tool
                        const missingInfo = validation.missing.length > 0 ? 
                            `Missing required information: ${validation.missing.join(', ')}` : '';
                        const validationErrors = validation.errors.length > 0 ? 
                            validation.errors.join('; ') : '';
                        
                        const userMessage = `I need some additional information before I can proceed. ${missingInfo} ${validationErrors}`.trim();
                        
                        updatedConversationHistory.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ 
                                validation_error: true, 
                                message: userMessage 
                            })
                        });
                        
                        toolResults.push({
                            tool: toolName,
                            arguments: toolArgs,
                            validation_error: userMessage
                        });
                        
                        continue; // Skip to next tool call
                    }
                    
                    // Execute the validated tool call
                    let toolResult;

                    // Check for calendar functions first
                    if (toolName === 'calendars_get-calendars') {
                        toolResult = await getCalendars(
                            toolArgs.query_locationId,
                            toolArgs.query_groupId,
                            toolArgs.query_showDrafted
                        );
                    }
                    else if (toolName === 'calendars_get-calendar-details') {
                        toolResult = await getCalendar(toolArgs.path_calendarId);
                    }
                    else if (toolName === 'calendars_get-available-slots') {
                        toolResult = await getFreeSlots(
                            toolArgs.query_calendarId,
                            toolArgs.query_startDate,
                            toolArgs.query_endDate,
                            toolArgs.query_timezone,
                            toolArgs.query_userId
                        );
                    }
                    else if (toolName === 'calendars_create-appointment') {
                        // Build appointment data object from body parameters
                        const appointmentData = {
                            calendarId: toolArgs.body_calendarId,
                            contactId: toolArgs.body_contactId,
                            startTime: toolArgs.body_startTime,
                            endTime: toolArgs.body_endTime,
                            title: toolArgs.body_title,
                            appointmentStatus: toolArgs.body_appointmentStatus,
                            assignedUserId: toolArgs.body_assignedUserId,
                            meetingLocationType: toolArgs.body_meetingLocationType,
                            meetingLocationId: toolArgs.body_meetingLocationId,
                            address: toolArgs.body_address,
                            ignoreDateRange: toolArgs.body_ignoreDateRange,
                            toNotify: toolArgs.body_toNotify,
                            ignoreFreeSlotValidation: toolArgs.body_ignoreFreeSlotValidation
                        };
                        
                        toolResult = await createAppointment(appointmentData);
                    }
                    else if (toolName === 'contacts_remove-tags-workaround') {
                        // Handle the remove tags workaround if you've implemented it
                        toolResult = await removeTagsWorkaround(
                            toolArgs.path_contactId, 
                            toolArgs.body_tags, 
                            pitToken, 
                            locationId
                        );
                    }
                    else {
                        // All other tools use MCP
                        toolResult = await callMCP(toolName, toolArgs, pitToken, locationId);
                    }
                    
                    updatedConversationHistory.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult, null, 2)
                    });

                    toolResults.push({
                        tool: toolName,
                        arguments: toolArgs,
                        result: toolResult
                    });

                } catch (error) {
                    console.error('Tool call error:', error);
                    
                    // Provide user-friendly error message
                    const userFriendlyError = formatUserFriendlyError(error, toolName, toolArgs);
                    
                    updatedConversationHistory.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ 
                            error: true, 
                            user_message: userFriendlyError,
                            technical_error: error.message 
                        })
                    });

                    toolResults.push({
                        tool: toolName,
                        arguments: toolArgs,
                        error: userFriendlyError
                    });
                }
            }

            // Get final response from Groq with tool results
            const finalMessages = [systemMessage, ...updatedConversationHistory];
            const finalResponse = await callGroq(finalMessages, null, groqApiKey, false);
            const finalContent = finalResponse.choices[0].message.content;
            
            updatedConversationHistory.push({ role: "assistant", content: finalContent });

            res.json({
                success: true,
                message: finalContent,
                toolCalls: toolResults,
                conversationHistory: updatedConversationHistory.slice(-20) // Keep last 20 messages
            });

        } else {
            // No tools needed, just regular response
            updatedConversationHistory.push({ role: "assistant", content: assistantMessage.content });

            res.json({
                success: true,
                message: assistantMessage.content,
                toolCalls: [],
                conversationHistory: updatedConversationHistory.slice(-20)
            });
        }

    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Add these calendar functions to your server.js file
// Make sure axios is already imported at the top of your file

// Add this test endpoint temporarily
app.post('/api/test-calendar-functions', async (req, res) => {
    try {
        console.log('Testing if calendar functions exist...');
        console.log('getCalendars function exists:', typeof getCalendars);
        console.log('getCalendar function exists:', typeof getCalendar);
        console.log('getFreeSlots function exists:', typeof getFreeSlots);
        console.log('createAppointment function exists:', typeof createAppointment);
        
        res.json({
            success: true,
            functions: {
                getCalendars: typeof getCalendars,
                getCalendar: typeof getCalendar,
                getFreeSlots: typeof getFreeSlots,
                createAppointment: typeof createAppointment
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;

        // Get credentials from environment variables
        const groqApiKey = process.env.GROQ_API_KEY;
        const pitToken = process.env.GHL_PIT_TOKEN;
        const locationId = process.env.GHL_LOCATION_ID;

        // Validation
        if (!message) {
            return res.status(400).json({ 
                error: 'Missing required field: message' 
            });
        }

        if (!groqApiKey || !pitToken || !locationId) {
            return res.status(500).json({ 
                error: 'Server configuration error: Missing API credentials in environment variables' 
            });
        }

        // Set headers for streaming
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
        });

        // Build system message
        const systemMessage = {
            role: "system",
            content: `You are a helpful assistant with access to Embark+ MCP tools. 
            You can help users manage their GHL contacts, conversations, opportunities, and more.
            When users ask for information that requires GHL data, use the appropriate tool.
            Always be helpful and explain what you're doing.
            The location ID is: ${locationId}`
        };

        // Build conversation history
        const messages = [systemMessage, ...(conversationHistory || []), { role: "user", content: message }];

        // Check for tools needed first (non-streaming)
        const initialResponse = await callGroq(messages, AVAILABLE_TOOLS, groqApiKey, false);
        const assistantMessage = initialResponse.choices[0].message;

        let updatedConversationHistory = [...(conversationHistory || []), { role: "user", content: message }];
        let toolResults = [];

        // Handle tool calls if any
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            updatedConversationHistory.push(assistantMessage);

            // Send tool execution updates
            res.write(`data: ${JSON.stringify({ type: 'tool_start', tools: assistantMessage.tool_calls.length })}\n\n`);

            // Execute each tool call
            for (const toolCall of assistantMessage.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);
                
                res.write(`data: ${JSON.stringify({ 
                    type: 'tool_call', 
                    tool: toolName, 
                    arguments: toolArgs 
                })}\n\n`);
                
                try {
                    const toolResult = await callMCP(toolName, toolArgs, pitToken, locationId);
                    
                    updatedConversationHistory.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult, null, 2)
                    });

                    toolResults.push({
                        tool: toolName,
                        arguments: toolArgs,
                        result: toolResult
                    });

                    res.write(`data: ${JSON.stringify({ 
                        type: 'tool_result', 
                        tool: toolName, 
                        success: true 
                    })}\n\n`);

                } catch (error) {
                    console.error('Tool call error:', error);
                    updatedConversationHistory.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: `Error: ${error.message}`
                    });

                    toolResults.push({
                        tool: toolName,
                        arguments: toolArgs,
                        error: error.message
                    });

                    res.write(`data: ${JSON.stringify({ 
                        type: 'tool_result', 
                        tool: toolName, 
                        success: false,
                        error: error.message 
                    })}\n\n`);
                }
            }

            // Stream final response
            const finalMessages = [systemMessage, ...updatedConversationHistory];
            const streamResponse = await callGroq(finalMessages, null, groqApiKey, true);
            
            res.write(`data: ${JSON.stringify({ type: 'stream_start' })}\n\n`);
            
            let fullContent = '';
            for await (const chunk of streamResponse) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    res.write(`data: ${JSON.stringify({ type: 'stream_chunk', content })}\n\n`);
                }
            }
            
            updatedConversationHistory.push({ role: "assistant", content: fullContent });
            
            res.write(`data: ${JSON.stringify({ 
                type: 'stream_end', 
                conversationHistory: updatedConversationHistory.slice(-20),
                toolCalls: toolResults
            })}\n\n`);

        } else {
            // No tools needed, just stream the response
            const streamResponse = await callGroq(messages, null, groqApiKey, true);
            
            res.write(`data: ${JSON.stringify({ type: 'stream_start' })}\n\n`);
            
            let fullContent = '';
            for await (const chunk of streamResponse) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    res.write(`data: ${JSON.stringify({ type: 'stream_chunk', content })}\n\n`);
                }
            }
            
            updatedConversationHistory.push({ role: "assistant", content: fullContent });
            
            res.write(`data: ${JSON.stringify({ 
                type: 'stream_end', 
                conversationHistory: updatedConversationHistory.slice(-20),
                toolCalls: []
            })}\n\n`);
        }

        res.end();

    } catch (error) {
        console.error('Streaming chat error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});

// Test MCP connectivity endpoint
app.post('/api/test-mcp', async (req, res) => {
    try {
        const groqApiKey = process.env.GROQ_API_KEY;
        const pitToken = process.env.GHL_PIT_TOKEN;
        const locationId = process.env.GHL_LOCATION_ID;

        if (!pitToken || !locationId) {
            return res.json({
                success: false,
                error: 'Missing environment variables',
                details: {
                    hasPitToken: !!pitToken,
                    hasLocationId: !!locationId,
                    pitTokenStart: pitToken ? pitToken.substring(0, 4) + '...' : 'missing'
                }
            });
        }

        // Test basic connectivity first
        console.log('Testing MCP connectivity...');
        console.log('PIT Token (first 10 chars):', pitToken.substring(0, 10) + '...');
        console.log('Location ID:', locationId);

        try {
            // Try the simplest possible request
            const testPayload = {
                tool: "locations_get-location",
                input: {}
            };

            console.log('Sending test request:', testPayload);

            const response = await axios.post('https://services.leadconnectorhq.com/mcp/', testPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${pitToken}`,
                    'locationId': locationId,
                    'Accept': 'application/json, text/event-stream' // FIXED: Both accept types required
                },
                timeout: 30000,
                validateStatus: function (status) {
                    return true; // Accept any status to see what we get
                }
            });

            console.log('MCP Response Status:', response.status);
            console.log('MCP Response Headers:', response.headers);
            console.log('MCP Response Data:', response.data);

            res.json({
                success: response.status === 200,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
                requestPayload: testPayload
            });

        } catch (error) {
            console.log('MCP Error Details:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers
            });

            res.json({
                success: false,
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseData: error.response?.data,
                responseHeaders: error.response?.headers
            });
        }

    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get available tools endpoint - FIXED HEADERS
app.get('/api/tools', async (req, res) => {
    try {
        // Set proper headers for MCP compatibility
        res.setHeader('Accept', 'application/json, text/event-stream');
        res.setHeader('Content-Type', 'application/json');
        
        res.json({ tools: AVAILABLE_TOOLS });
    } catch (error) {
        console.error('Tools endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from 'public' directory`);
    console.log(`🔧 API endpoints:`);
    console.log(`   POST /api/chat - Main chat endpoint`);
    console.log(`   POST /api/chat/stream - Streaming chat endpoint`);
    console.log(`   POST /api/test-mcp - Test MCP connectivity`);
    console.log(`   GET  /api/health - Health check`);
    console.log(`   GET  /api/tools - Available tools`);
});

export default app;