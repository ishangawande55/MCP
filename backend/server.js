require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Municipal Credential API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`Blockchain RPC: ${process.env.BLOCKCHAIN_RPC_URL}`);
});