import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import base64 from 'base-64';
import nodemailer from "nodemailer";

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8888 } = process.env;
const base = "https://api-m.sandbox.paypal.com";
const app = express();
const sellerEmail = "ayeshakhan.mct@gmail.com"
const sellerEmail_pass = process.env.SELLER_EMAIL_PASSWORD

app.set("view engine", "ejs");
app.set("views", "./server/views");
app.use(express.static("client"));

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
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
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

  return handleResponse(response);
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

  const response = await fetch(url, {
      headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
      body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
  });

  return handleResponse(response);
};

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
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
        if (!response.ok) throw new Error('Failed to fetch email, Status: ${response.status}, ${response.statusText}');
        
        const { email : email, file_path : file_path } = await response.json();
        console.log('Email fetched:', email); // Use the email as needed
        console.log('File path fetched:', file_path);
    } catch (error) {
      console.error('Error fetching Forminator entry email or file path:', error);
    }
}


// Setup email transporter
let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Replace with your SMTP host
    port: 465, // Common port for SMTP
    secure: true, // true for 465, false for other ports
    auth: {
        user: 'ayeshakhan.mct@gmail.com', // Replace with your SMTP username
        pass: sellerEmail_pass, // Replace with your SMTP password
    },
});

// Function to send an email
async function sendEmail(to, subject, htmlContent, attachments = []) {
    let mailOptions = {
        from: sellerEmail, // Sender address
        to: to, // List of receivers
        subject: subject, // Subject line
        html: htmlContent, // HTML body content
        attachments: attachments, // An array of attachments
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('Failed to send email:', error);
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


// /api/orders route handler
app.post("/api/orders", async (req, res) => {
  try {
      // Assuming the first item in the cart contains the necessary details
      const { id: entryId, price: totalPrice } = req.body.cart[0];

      console.log(`Creating order for entryId ${entryId} with totalPrice ${totalPrice}`);

      // Proceed to create the order with the provided totalPrice
      const { jsonResponse, httpStatusCode } = await createOrder(totalPrice);

      // Respond with the result of the order creation
      res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
      console.error("Failed to create order:", error);
      res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    
    res.status(httpStatusCode).json(jsonResponse);

    // Check if transaction was successful
    if (httpStatusCode === 200) {
      const { id: entryId, price: totalPrice } = req.body.cart[0];
      console.log('EntryID and Price Retrieved');

      // Fetch customer email
      const { customerEmail, file_path } = await fetchForminatorEntryEmail(entryId);
      
    // Read the file to be attached
    const fileContent = fs.readFileSync(file_path);
    
    // Define the email options, including the attachment
    let mailOptions = {
      from: sellerEmail,
      to: to, // list of receivers
      subject: subject,
      text: text,
      attachments: [
          {
              filename: path.basename(fileContent),
              content: fileContent,
          },
      ],
  };

      if (customerEmail) {
        console.log('Customer Email Received');

        // Send customer email
        await sendEmail(customerEmail, 'testing customer', 'testing cust body', );
        // Send seller email
        await sendEmail(mailOptions);
        console.log('Message sent: %s', info.messageId);
      } else {
        console.error('Customer email not found for entryid:', entryId)
      }

    }
    
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

app.listen(PORT, () => {
  console.log(`Node server listening at http://localhost:${PORT}/`);
});

// Endpoint to receive webhook data
app.post("/api/webhook", async (req, res) => {
  console.log('Initiating webhook route handler');
  
  // Respond to indicate successful receipt of webhook data
  console.log('Webhook data stored successfully')
  res.status(200).send({ message: "Webhook data stored successfully" });
});
