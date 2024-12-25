const express = require('express');
const fetch = require('node-fetch'); // For making HTTP requests
const cors = require('cors'); // To enable CORS on your backend
const admin = require('firebase-admin'); // Firebase Admin SDK
const { setDoc } = require('firebase/firestore');

const app = express();

// Enable CORS for all requests
app.use(cors());
app.use(express.json()); // For parsing application/json

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('./rimmon-fc2b6-firebase-adminsdk-ks029-6876f68193.json')), // Replace with your service account credentials
});
const firestore = admin.firestore();

// Endpoint to handle payment request
app.post('/api/payment', async (req, res) => {
  const paymentData = req.body;

  try {
    // Send a POST request to Chapa API to initialize payment
    const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer CHASECK-oRiAhQVadyEwI4rZkr8llxfGFnAqWDmj', // Replace with your Chapa test API key
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    const data = await response.json(); // Parse the Chapa response

    if (data.status !== 'success' || !data.data?.checkout_url) {
      throw new Error('Invalid payment response from Chapa');
    }

    console.log('Chapa Response:', data);
    res.json(data); // Send the response back to the frontend

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Endpoint to handle Chapa payment callback
app.post('/api/payment/callback', async (req, res) => {
  const { tx_ref, status } = req.body;
  console.log('Callback received for tx_ref:', tx_ref, 'status:', status);

  try {
    // Step 1: Validate the payment with Chapa API
    const chapaResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer CHASECK-oRiAhQVadyEwI4rZkr8llxfGFnAqWDmj', // Your Chapa test API key here
      },
    });

    const chapaResult = await chapaResponse.json();

    console.log('Chapa Verification Response:', chapaResult);

    if (chapaResult.status !== 'success') {
      throw new Error('Payment validation failed');
    }

    // Step 2: Update Firestore - Update the order status to 'completed'
    const transactionDoc = firestore.collection('orders').doc(tx_ref);  // Assuming the tx_ref is unique
    await setDoc(transactionDoc, {
      status: 'completed',
      paymentDate: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send success response
    res.status(200).send('Payment processed and Firestore updated successfully');
  } catch (error) {
    console.error('Error handling Chapa callback:', error);
    res.status(500).send('Error processing payment callback');
  }
});


app.get('/api/verify/:uniqueId', async (req, res) => {
    const { uniqueId } = req.params;
    const chapaUrl = `https://api.chapa.co/v1/transaction/verify/${uniqueId}`;
    const transactionDoc = firestore.collection('orders').doc(uniqueId); 
  
    try {
      const response = await fetch(chapaUrl, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer CHASECK-oRiAhQVadyEwI4rZkr8llxfGFnAqWDmj', // Use your Chapa API Key
        },
      });
  
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to verify transaction' });
      }
  
      const result = await response.json();
      res.json(result); // Forward the Chapa response to the frontend
    } catch (error) {
      console.error('Error verifying transaction:', error);
      res.status(500).json({ error: 'Server error while verifying transaction' });
    }
  });

// Start the server on port 5000
app.listen(5001, () => console.log('Server running on http://localhost:5001'));
