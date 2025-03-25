const { Client } = require('square');
require('dotenv').config();

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT || 'sandbox', // 'sandbox' 또는 'production'
});

async function fetchCustomerCards(customerId) {
  try {
    const customersApi = client.customersApi;

    // Customer 정보 가져오기
    const response = await customersApi.retrieveCustomer(customerId);
    const customer = response.result.customer;

    console.log("Customer Details:", customer);

    // 카드 정보 확인
    if (customer && customer.cards) {
      console.log("Saved Cards:", customer.cards);
    } else {
      console.log("No cards saved for this customer.");
    }
  } catch (error) {
    console.error("Error fetching customer details:", error);
  }
}

// Command-line arguments 처리
if (require.main === module) {
  const customerId = process.argv[2];
  if (!customerId) {
    console.error("Error: Please provide a customer ID as an argument.");
    process.exit(1);
  }
  fetchCustomerCards(customerId);
}

module.exports = fetchCustomerCards;

