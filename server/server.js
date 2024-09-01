import express, { json } from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
import { fileURLToPath } from 'url';
import base64 from 'base-64';
import nodemailer from "nodemailer";
import path from 'path';

// Import the database connection pool cool
import db from './database.js'; 
// Adjust the path to where database.js file is located

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8888 } = process.env;
const base = "https://api-m.paypal.com";
const app = express();
const sellerEmail = "ayeshakhan.mct@gmail.com"
const sellerEmail_pass = process.env.SELLER_EMAIL_PASSWORD

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use('/app', express.static(path.join(__dirname, '../client')));


// parse post params sent in body in json format
app.use(express.json());

/**
 * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
 * @see https://developer.paypal.com/api/rest/authentication/
 */
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET,
    ).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error generating access token:", data);
      throw new Error(data.error || "Failed to generate access token");
    }

    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
    throw error;
  }
};

/**
 * Generate a client token for rendering the hosted card fields.
 * @see https://developer.paypal.com/docs/checkout/advanced/integrate/#link-integratebackend
 */
const generateClientToken = async () => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/identity/generate-token`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept-Language": "en_US",
      "Content-Type": "application/json",
    },
  });

  return handleAccessTokenResponse(response);
};

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (totalPrice) => {
  console.log("Total price for the order:", totalPrice);

  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  const payload = {
      intent: "CAPTURE",
      purchase_units: [{
          amount: {
              currency_code: "USD",
              value: totalPrice.toString(), // Ensure totalPrice is a string
          },
      }],
  };

  try {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Error creating PayPal order:", await response.json());
      throw new Error(`Failed to create PayPal order: ${response.status} - ${response.statusText}`);
    }

    return handleAccessTokenResponse(response);
  } catch (error) {
    console.error("Failed to create order with PayPal:", error);
    throw error;
  }
};

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Error capturing PayPal order:", await response.json());
      throw new Error(`Failed to capture PayPal order: ${response.status} - ${response.statusText}`);
    }

    return handleResponse(response);
  } catch (error) {
    console.error("Failed to capture order with PayPal:", error);
    throw error;
  }
};

async function handleAccessTokenResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    }
  } catch (error) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
       
    // Check the payment status in the jsonResponse
    if (jsonResponse.status ==='COMPLETED') {
      console.log('Payment completed.');
      return { status: 'COMPLETED', jsonResponse , httpStatusCode: response.status };
    } else {
      console.log('Payment not completed, current status:', jsonResponse.status);
      return { status: jsonResponse.status, jsonResponse , httpStatusCode: response.status };
    };
  } catch (error) {
    const errorMessage = await response.text();
    console.error("Error handling PayPal response:", errorMessage);
    throw new Error(errorMessage);
  }
}

async function fetchForminatorEntryEmail(entryId) {
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;  // Use the generated application password
    const url = `https://comprehensivetranslator.com/wp-json/custom/v1/entry-email/?entry_id=${entryId}`;

    try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Authorization': 'Basic ' + base64.encode(`${username}:${appPassword}`),
              'Content-Type': 'application/json'
          }
      });
        if (!response.ok) throw new Error(`Failed to fetch email, Status: ${response.status}, ${response.statusText}`);
        
        const data = await response.json();
        return data; // This should include both email and file_path
    } catch (error) {
        console.error('Error fetching Forminator entry email or file path:', error);
        return null;
    }
}

// Setup email transporter
let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Replace with your SMTP host
    port: 587, // Common port for SMTP
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'ayeshakhan.mct@gmail.com', // Replace with your SMTP username
        pass: sellerEmail_pass, // Replace with your SMTP password
    },
    debug: true, // show debug output
    logger: true // log information in console
});

// Function to send an email
async function sendEmail(mailOptions) {

    transporter.verify(function(error, success) {
        if (error) {
            console.log(error);
        } else {
          console.log(" server ready")
        }
    });

    console.log(mailOptions)

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('Failed to send email:', error);
    }
}

async function updatePaymentStatus(entryId, status) {
  // Only update the payment status if the status is 'COMPLETED'
  if (status === 'COMPLETED') {
    const sql = `UPDATE wp_frmt_form_entry_meta SET meta_value = ? WHERE entry_id = ? AND meta_key = 'hidden-1'`;
    try {
      const [result] = await db.query(sql, ['Paid', entryId]);
      console.log('Payment status updated successfully:', result);
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  } else {
    console.log(`Payment status for entry ${entryId} is not 'COMPLETED'. Current status: ${status}`);
  }
}


async function getPriceForToken(token) {
  try {
      // Query the database to retrieve the entryId and totalPrice using the secureToken
      const sql = `SELECT entry_id, calculated_price as totalPrice 
                   FROM wp_custom_form_data 
                   WHERE secure_token = ? LIMIT 1`;

      const [rows] = await db.execute(sql, [token]);

      if (rows.length === 0) {
          console.error('No matching entry found for the given token:', token);
          return { entryId: null, totalPrice: null };
      }

      console.log('Retrieved data for token:', token, 'Data:', rows[0]);

      const entryId = rows[0].entry_id;
      const totalPrice = rows[0].totalPrice;

      return { entryId, totalPrice };
  } catch (error) {
      console.error('Error retrieving price:', error);
      throw new Error('Price not found for the given token');
  }
}

// Store transaction id for pending payments in the "hidden-2" meta key
async function storeTransactionId(entryId, transactionId) {
  const sql = `
    UPDATE wp_frmt_form_entry_meta 
    SET meta_value = ? 
    WHERE entry_id = ? AND meta_key = 'hidden-2'
  `;
  
  try {
    const [result] = await db.query(sql, [transactionId, entryId]);
    console.log('Transaction ID stored successfully in hidden-2. Result:', result);
  } catch (error) {
    console.error('Error storing transaction ID:', error);
  }
}

// retrieve entryid to update paymenet status when webhook from paypal received
async function getEntryIdByTransactionId(transactionId) {
  const sql = `SELECT entry_id FROM wp_frmt_form_entry_meta WHERE meta_key = 'hidden-2' AND meta_value = ? LIMIT 1`;
try {
    const [rows] = await db.query(sql, [transactionId]);
    if (rows.length > 0) {
        return rows[0].entry_id;
    }
    return null;
} catch (error) {
    console.error('Error fetching entry by transaction ID:', error);
    return null;
}

}


// render checkout page with client id & unique client token
app.get("/", async (req, res) => {
  try {
    const { jsonResponse } = await generateClientToken();
    res.render("checkout", {
      clientId: PAYPAL_CLIENT_ID,
      clientToken: jsonResponse.client_token,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/test", (req, res) => {
  res.render("test");
});

app.post("/api/orders", async (req, res) => {
  const { secureToken } = req.body;
  console.log("Received secure token:", secureToken);

  if (!secureToken) {
      console.error('Secure token is missing.');
      return res.status(400).json({ error: 'Secure token is missing.' });
  }

  try {
      const { entryId, totalPrice } = await getPriceForToken(secureToken); // Query the database with the token

      if (!entryId || !totalPrice) {
          console.error('Invalid token or no data found.');
          return res.status(400).json({ error: 'Invalid token or no data found.' });
      }

      console.log('Successfully retrieved data:', { entryId, totalPrice });

      const { jsonResponse, httpStatusCode } = await createOrder(totalPrice);
      res.status(httpStatusCode).json(jsonResponse);

  } catch (error) {
      console.error('Failed to create order:', error.message);
      res.status(500).json({ error: 'Failed to create order.' });
  }
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
      const { orderID } = req.params;
      const { secureToken } = req.body;

      // Check if the secure token is missing
      if (!secureToken) {
          console.error("Secure token is missing.");
          return res.status(400).json({ error: "Secure token is missing." });
      }

      console.log("Received secure token:", secureToken);

      // Fetch entryId and totalPrice using the secureToken
      let entryId, totalPrice;
      try {
          ({ entryId, totalPrice } = await getPriceForToken(secureToken)); // Query the database with the token
          if (!entryId || !totalPrice) {
              console.error("Invalid token or no data found.");
              return res.status(400).json({ error: "Invalid token or no data found." });
          }
      } catch (error) {
          console.error("Failed to retrieve data for the token:", error);
          return res.status(500).json({ error: "Failed to retrieve order data." });
      }

      // Capture the order via PayPal
      const { status, jsonResponse, httpStatusCode } = await captureOrder(orderID);
      console.log("Capture Order HTTP Status Code:", httpStatusCode);

      // Store the transaction ID regardless of status
      const transaction =
        jsonResponse?.purchase_units?.[0]?.payments?.captures?.[0] ||
        jsonResponse?.purchase_units?.[0]?.payments?.authorizations?.[0];
      const transactionId = transaction?.id;
      
      await storeTransactionId(entryId, transactionId);

      // Check if transaction was successful
      if (status === 'COMPLETED') {
          console.log('EntryID and Price Retrieved', entryId, '&', totalPrice, 'USD');

          // Update payment status
          await updatePaymentStatus(entryId, 'paid');

          // Declaring outside try-catch to have larger scope
          let emailData = null;

          // Fetch customer email
          try {
              emailData = await fetchForminatorEntryEmail(entryId);
          } catch (error) {
              console.error('Failed to fetch email data:', error);
          }

          if (emailData && emailData.email && emailData.file_path) {
              console.log('Customer Email:', emailData.email);
              console.log('File Path:', emailData.file_path);

              // Example of reading file content and preparing an attachment
              const attachment = [{
                  filename: path.basename(emailData.file_path),
                  path: emailData.file_path
              }];

              // Define the customer email options, including the attachment
              let mailOptionsCustomer = {
                  from: sellerEmail,
                  to: emailData.email, // list of receivers
                  subject: 'Order Confirmation',
                  text: 'Your order has been confirmed.'
              };

              console.log('The data being passed for customer email', mailOptionsCustomer);

              try {
                  await sendEmail(mailOptionsCustomer);
                  console.log('Customer email sent.');
              } catch (error) {
                  console.error('Failed to send customer email:', error);
              }

              let mailOptionsSeller = {
                  from: sellerEmail,
                  to: sellerEmail, // list of receivers
                  subject: 'Order Confirmation',
                  text: 'You have a new order',
                  attachments: attachment
              };

              console.log('The data being passed for seller email', mailOptionsSeller);

              try {
                  await sendEmail(mailOptionsSeller);
                  console.log('Seller email sent.');
              } catch (error) {
                  console.error('Failed to send seller email:', error);
              }

          } else {
              console.error('Customer email not found for entryId:', entryId);
          }

          res.status(httpStatusCode).json(jsonResponse);

      } else {
          console.error("Failed to capture the transaction. Payment status:", status);
          res.status(httpStatusCode).json({ error: `Failed to capture transaction. Payment status: ${status}` });
      }

  } catch (error) {
      console.error("Failed to capture order:", error.message);
      res.status(500).json({ error: "Failed to capture order." });
  }
});

// iF THE SERVER ROUTING IS removed sue to a rebuilding process then go to /etc/nginx/conf.d/domains and edit the http + https config files
// ie. comprehensivetranslator.com.conf and ....ssl.conf to include paths to the app

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Node server listening at http://localhost:${PORT}/`);
});

// // Endpoint to receive webhook data
// Endpoint to receive webhook data
app.post("/api/paypal/webhook", async (req, res) => {
  try {
      const { event_type, resource } = req.body;

      if (event_type === "PAYMENT.CAPTURE.COMPLETED" && resource.status === "COMPLETED") {
          const transactionId = resource.id;
          const entryId = await getEntryIdByTransactionId(transactionId);

          if (entryId) {
              // Update the payment status to 'paid' if it is now completed
              await updatePaymentStatus(entryId, 'COMPLETED');
              res.status(200).send('Webhook processed successfully.');
          } else {
              console.error('No matching entry found for transaction ID:', transactionId);
              res.status(400).send('No matching entry found.');
          }
      } else {
          console.log('Payment is not completed. Ignoring the event.');
          res.status(200).send('Payment not completed. No action taken.');
      }
  } catch (error) {
      console.error("Failed to process PayPal webhook:", error.message);
      res.status(500).send("Failed to process PayPal webhook.");
  }
});