# PayPal Payment Customizer

This Node.js application customizes the PayPal payment process. It integrates with a WordPress site using Forminator forms to retrieve order information and processes payments through the PayPal API. The app securely handles pricing information and allows users to reopen the PayPal payment window if needed.

## Features

- **Secure Data Transfer:** Retrieves and stores form data securely using server-side storage.
- **Custom PayPal Integration:** Customizes the PayPal checkout experience based on form inputs.
- **Reopen Payment Window:** Allows users to close and reopen the PayPal payment window without losing their payment information.

## Prerequisites

- **Node.js**: Ensure Node.js is installed.
- **NPM**: Node package manager should be installed with Node.js.
- **PayPal Developer Account**: A PayPal sandbox account is needed for testing.

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/babypanda212/comprehensive-translator-paypal.git
   cd comprehensive-translator-paypal

2. **Install dependencies:**

  npm install

3. **Environment Variables:**

Create a `.env` file in the root directory with the following content:

PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PORT=8888
WP_USERNAME=your_wp_username
WP_APP_PASSWORD=your_wp_app_password
SELLER_EMAIL_PASSWORD=your_seller_email_password


4. **Start the Application:**

pm2 start server.js --name "paypal-app"


## Usage

To use this application, navigate to your deployment URL and follow the user interface prompts to complete a PayPal transaction based on input from a Forminator form submission.

## Contributing

Contributions are welcome! Please fork the repository and submit pull requests for any enhancements you wish to share.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
