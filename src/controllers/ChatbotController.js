const { OpenAI } = require('openai');
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

let openai = null;
try {
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
} catch (error) {
    console.error('Error initializing OpenAI client:', error);
}

const schemaContext = `
Tables available for querying:

1. orders
   - id (INT)
   - orderNo (VARCHAR)
   - totalAmount (DECIMAL)
   - status (VARCHAR: pending, preparing, ready, hold, complete, cancel)
   - paymentStatus (VARCHAR: pending, paid, partial_refund, refund)
   - orderType (VARCHAR: takeaway, dining, delivery)
   - createdAt (DATETIME)

2. orderitems
   - id (INT)
   - orderId (INT, FK to orders)
   - productId (INT, FK to products)
   - quantity (INT)
   - unitPrice (DECIMAL)
   - status (VARCHAR: pending, preparing, ready, served, cancelled)

3. payments
   - id (INT)
   - order_id (INT, FK to orders)
   - amount (DECIMAL)
   - payment_method (VARCHAR: cash, card, loyalty_points)
   - status (VARCHAR: pending, paid, refund, partial_refund)
   - created_at (DATETIME)

4. products
   - id (INT)
   - name (VARCHAR)
   - status (VARCHAR: active, inactive)
   - categoryId (INT, FK to categories)

5. categories
   - id (INT)
   - name (VARCHAR)

6. customers
   - id (INT)
   - name (VARCHAR)
   - mobile (VARCHAR)

7. stock_items (Raw Materials)
   - id (INT)
   - material_id (INT, FK to materials)
   - branch_id (INT)
   - quantity_value (DECIMAL)
   - quantity_unit (VARCHAR)
   - status (VARCHAR: available, low, out, expired)

8. product_bundles (Combo Packs)
   - id (INT)
   - name (VARCHAR)
   - description (TEXT)
   - expire_date (DATE)
   - status (VARCHAR: active, inactive)

9. bogo_promotions (Buy One Get One)
   - id (INT)
   - name (VARCHAR)
   - buyQuantity (INT)
   - getQuantity (INT)
   - expiryDate (DATE)
   - status (VARCHAR: active, inactive)

10. discounts
   - id (INT)
   - name (VARCHAR)
   - expiryDate (DATE)
   - status (VARCHAR: active, inactive)

11. materials
   - id (INT)
   - name (VARCHAR)

12. variations
   - id (INT)
   - productId (INT, FK to products)
   - name (VARCHAR)

13. variationoptions
   - id (INT)
   - variationId (INT, FK to variations)
   - name (VARCHAR)

14. variationprices (Product Stock)
   - id (INT)
   - variationOptionId (INT, FK to variationoptions)
   - branchId (INT)
   - quantity (INT)
   - isUnlimited (BOOLEAN: 0 or 1)
`;

exports.handleChat = async (req, res) => {
    try {
        if (!openai) {
            return res.status(500).json({ message: 'OpenAI client is not configured. Please set OPENAI_API_KEY.' });
        }

        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }

        const tools = [
            {
                type: 'function',
                function: {
                    name: 'query_database',
                    description: 'Execute a read-only SQL query against the POS database to answer user questions about Orders, Payments, Revenue, Stock Details, Low Stock, Products, etc. The user might ask "How many Orders..." or "List Orders...". returns standard array of objects.',
                    parameters: {
                        type: 'object',
                        properties: {
                            sql: {
                                type: 'string',
                                description: 'The SQL query to execute. MUST be a SELECT statement.',
                            },
                        },
                        required: ['sql'],
                    },
                },
            }
        ];

        const systemMessage = {
            role: 'system',
            content: `You are a helpful POS assistant. You can answer questions about data. 
            
            Database Schema Context:
            ${schemaContext}
            
            Rules:
            1. Only generate SQL for READ operations (SELECT). Do not generate INSERT, UPDATE, DELETE, DROP, ALTER, etc.
            2. If the user asks a specific data question, call 'query_database' tool.
            3. Be concise and professional in your final answer.
            4. NEVER show the raw SQL query or internal reasoning in your final response to the user.
            5. If a query returns an empty array "[]", it means there are no records matching the request. State that there are no such records (e.g., "There are currently no low stock items"), do NOT say you couldn't retrieve the data.
            6. If a technical error occurs (like an error object), apologize and state you couldn't retrieve the data. Do not explain the SQL error.
            7. Current Date is ${new Date().toISOString()}. To query today's records, append AND DATE(createdAt) = CURDATE().
            8. For 'low stock products', you MUST use exactly this join path: JOIN variationprices vp JOIN variationoptions vo ON vp.variationOptionId = vo.id JOIN variations v ON vo.variationId = v.id JOIN products p ON v.productId = p.id WHERE vp.quantity <= 10 AND vp.isUnlimited = 0.
            9. To calculate 'Total Revenue', you MUST use exactly: SELECT SUM(totalAmount) FROM orders WHERE (status = 'complete' OR id IN (SELECT order_id FROM payments WHERE status IN ('paid', 'success', 'completed'))). If asked for "today's revenue", append AND DATE(createdAt) = CURDATE() outside the parentheses.
            10. Always format monetary values using Sri Lankan Rupees (Rs.), NOT dollars ($).
            11. CRITICAL: Do NOT show image URLs or markdown image links in your responses. Ignore any 'image' or 'url' fields in the data.`
        };

        const messages = [systemMessage, { role: 'user', content: message }];

        let response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: tools,
            tool_choice: 'auto',
        });

        const responseMessage = response.choices[0].message;


        if (responseMessage.tool_calls) {
            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                if (toolCall.function.name === 'query_database') {
                    const args = JSON.parse(toolCall.function.arguments);
                    let sqlQuery = args.sql;

                    console.log('AI generated SQL query:', sqlQuery);

                    if (!sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
                        console.error('Blocked non-SELECT query attempt:', sqlQuery);
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: 'query_database',
                            content: JSON.stringify({ error: "Only SELECT queries are allowed for security reasons." }),
                        });
                        continue;
                    }

                    try {
                        const data = await sequelize.query(sqlQuery, {
                            type: QueryTypes.SELECT
                        });
                        
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: 'query_database',
                            content: JSON.stringify(data),
                        });
                    } catch (dbError) {
                        console.error('Database query error:', dbError);
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: 'query_database',
                            content: JSON.stringify({ error: "Failed to execute query due to an error." }),
                        });
                    }
                }
            }

            const secondResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
            });

            return res.json({ reply: secondResponse.choices[0].message.content });
        }

        return res.json({ reply: responseMessage.content });

    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ message: 'Internal server error while processing chatbot request' });
    }
};
