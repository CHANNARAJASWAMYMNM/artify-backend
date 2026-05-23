// Native test suite for Artify API
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.JWT_SECRET = 'test_secret_key';
process.env.COMMISSION_RATE = '0.10';

const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 Starting API Verification Test Suite...');

// Start the backend server as a child process
const serverProcess = spawn('node', ['src/app.js'], {
  cwd: __dirname + '/..',
  env: { ...process.env }
});

let serverOutput = '';
serverProcess.stdout.on('data', (data) => {
  serverOutput += data.toString();
  // Optional: print log for debugging
  // console.log('[Server Log]:', data.toString().trim());
});

serverProcess.stderr.on('data', (data) => {
  console.error('[Server Error Output]:', data.toString());
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runTests = async () => {
  const baseUrl = 'http://localhost:5001/api';

  // Wait 3 seconds for server to start
  console.log('⏳ Waiting for server to boot on port 5001...');
  await delay(3000);

  let sellerToken = '';
  let customerToken = '';
  let sellerUserId = '';
  let customerUserId = '';
  let testProductId = '';
  let testOrderId = '';

  try {
    // 1. Health Check
    console.log('\n🟢 Test 1: Health Check');
    const healthRes = await fetch('http://localhost:5001/health');
    const healthData = await healthRes.json();
    console.log('Health Check Response:', healthData);
    if (healthData.status !== 'healthy' || healthData.database !== 'InMemoryMock') {
      throw new Error('Health check failed');
    }

    // 2. Register Seller
    console.log('\n🟢 Test 2: Register Seller');
    const regSellerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'artisan_tester@artify.com',
        password: 'password123',
        role: 'seller',
        shopName: 'Tester Handcrafts',
        location: 'Jaipur, Rajasthan',
        craftType: 'Blue Pottery',
        story: 'Just a mock seller testing the Artify API pipeline.'
      })
    });
    const regSellerData = await regSellerRes.json();
    console.log('Register Seller Response:', regSellerData);
    if (!regSellerData.success || !regSellerData.token) {
      throw new Error('Seller registration failed');
    }
    sellerToken = regSellerData.token;
    sellerUserId = regSellerData.user._id;

    // 3. Register Customer
    console.log('\n🟢 Test 3: Register Customer');
    const regCustRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer_tester@artify.com',
        password: 'password123',
        role: 'customer'
      })
    });
    const regCustData = await regCustRes.json();
    console.log('Register Customer Response:', regCustData);
    if (!regCustData.success || !regCustData.token) {
      throw new Error('Customer registration failed');
    }
    customerToken = regCustData.token;
    customerUserId = regCustData.user._id;

    // 4. Log in Seller
    console.log('\n🟢 Test 4: Log in Seller');
    const loginSellerRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'artisan_tester@artify.com',
        password: 'password123'
      })
    });
    const loginSellerData = await loginSellerRes.json();
    console.log('Login Seller Response:', loginSellerData);
    if (!loginSellerData.success || !loginSellerData.token) {
      throw new Error('Seller login verification failed');
    }

    // 5. Log in Admin & Approve Seller
    console.log('\n🟢 Test 5: Log in Admin & Approve Seller');
    const loginAdminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@artify.com',
        password: 'password123'
      })
    });
    const loginAdminData = await loginAdminRes.json();
    console.log('Login Admin Response:', loginAdminData);
    if (!loginAdminData.success || !loginAdminData.token) {
      throw new Error('Admin login failed');
    }
    const adminToken = loginAdminData.token;

    // Get pending sellers
    const pendingRes = await fetch(`${baseUrl}/admin/sellers/pending`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const pendingData = await pendingRes.json();
    console.log('Pending Sellers List:', pendingData.sellers.length);

    // Approve the seller profile (need profile ID)
    const sellerProfileId = regSellerData.sellerProfile._id;
    const approveRes = await fetch(`${baseUrl}/admin/sellers/${sellerProfileId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ approve: true })
    });
    const approveData = await approveRes.json();
    console.log('Approve Seller Response:', approveData);
    if (!approveData.success || !approveData.sellerProfile.isApproved) {
      throw new Error('Seller approval failed');
    }

    // 6. Create Product
    console.log('\n🟢 Test 6: Create Product (Seller only)');
    const createProductRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        name: 'Tester Clay Cup',
        description: 'Test product for API pipeline validation.',
        story: 'Formed during automated testing under the Node process.',
        price: 150,
        stock: 20,
        category: 'Pottery',
        images: ['https://example.com/test-cup.jpg']
      })
    });
    const createProductData = await createProductRes.json();
    console.log('Create Product Response:', createProductData);
    if (!createProductData.success || !createProductData.product._id) {
      throw new Error('Product creation failed');
    }
    testProductId = createProductData.product._id;

    // 7. Get Products (Public)
    console.log('\n🟢 Test 7: Get Products List');
    const getProductsRes = await fetch(`${baseUrl}/products`);
    const getProductsData = await getProductsRes.json();
    console.log(`Fetched Products Count: ${getProductsData.products.length}`);
    if (!getProductsData.success || getProductsData.products.length === 0) {
      throw new Error('Products listing failed');
    }

    // 8. Place Order (Customer only)
    console.log('\n🟢 Test 8: Place Order');
    const createOrderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        items: [{ product: testProductId, quantity: 2 }],
        paymentMethod: 'COD',
        shippingAddress: {
          name: 'Jane Doe',
          street: '456 Test Ave',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302001',
          phone: '9999999999'
        }
      })
    });
    const createOrderData = await createOrderRes.json();
    console.log('Create Order Response:', createOrderData);
    if (!createOrderData.success || !createOrderData.order._id) {
      throw new Error('Order placement failed');
    }
    testOrderId = createOrderData.order._id;
    // Check commission amounts (150 * 2 = 300 total, 10% commission = 30, 90% payout = 270)
    if (createOrderData.order.commissionAmount !== 30 || createOrderData.order.sellerPayoutAmount !== 270) {
      throw new Error('Commission payout calculations failed');
    }

    // 9. Update Shipping Status (Seller/Admin)
    console.log('\n🟢 Test 9: Update Shipping Status');
    const updateShipRes = await fetch(`${baseUrl}/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ shippingStatus: 'Shipped' })
    });
    const updateShipData = await updateShipRes.json();
    console.log('Update Shipping Response:', updateShipData);
    if (!updateShipData.success || updateShipData.order.shippingStatus !== 'Shipped') {
      throw new Error('Shipping status update failed');
    }

    // 10. Fetch Notifications
    console.log('\n🟢 Test 10: Fetch Notifications');
    const notifyRes = await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const notifyData = await notifyRes.json();
    console.log('Customer Notifications:', notifyData.notifications);
    if (!notifyData.success || notifyData.notifications.length === 0) {
      throw new Error('Notifications collection failed');
    }

    // 11. Update User Role (Admin only)
    console.log('\n🟢 Test 11: Update User Role (Admin only)');
    const updateRoleRes = await fetch(`${baseUrl}/admin/users/${customerUserId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ role: 'admin' })
    });
    const updateRoleData = await updateRoleRes.json();
    console.log('Update Role Response:', updateRoleData);
    if (!updateRoleData.success || updateRoleData.user.role !== 'admin') {
      throw new Error('User role update failed');
    }

    console.log('\n✅ ALL API ENDPOINT TESTS PASSED SUCCESSFULY!');
    cleanup(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    cleanup(1);
  }
};

const cleanup = (code) => {
  console.log('🔌 Shutting down test server...');
  serverProcess.kill();
  process.exit(code);
};

runTests();
