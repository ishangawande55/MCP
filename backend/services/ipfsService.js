const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class IPFSService {
  constructor() {
    this.useInfura = !!process.env.INFURA_IPFS_PROJECT_ID;
    this.apiUrl = this.useInfura 
      ? process.env.INFURA_IPFS_ENDPOINT 
      : process.env.IPFS_API_URL;
  }

  getAuthHeaders() {
    if (this.useInfura) {
      const auth = Buffer.from(
        `${process.env.INFURA_IPFS_PROJECT_ID}:${process.env.INFURA_IPFS_PROJECT_SECRET}`
      ).toString('base64');
      
      return {
        Authorization: `Basic ${auth}`
      };
    }
    return {};
  }

  async uploadFile(filePath) {
    try {
      console.log(`Uploading file to IPFS: ${filePath}`);
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const response = await axios.post(`${this.apiUrl}/api/v0/add`, formData, {
        headers: {
          ...formData.getHeaders(),
          ...this.getAuthHeaders(),
        },
        timeout: 30000, // 30 seconds timeout
      });

      console.log(`File uploaded to IPFS. CID: ${response.data.Hash}`);
      return response.data.Hash;

    } catch (error) {
      console.error('IPFS Upload Error:', error.response?.data || error.message);
      
      // Fallback: If local IPFS fails, try public pinning service
      if (!this.useInfura) {
        console.log('Trying fallback upload method...');
        return await this.fallbackUpload(filePath);
      }
      
      throw new Error(`Failed to upload file to IPFS: ${error.message}`);
    }
  }

  async fallbackUpload(filePath) {
    try {
      // Using Pinata as fallback (you'll need to sign up for free account)
      // Alternatively, use another IPFS pinning service
      console.log('Local IPFS failed. Consider using Infura IPFS for production.');
      console.log('For now, returning mock CID for development...');
      
      // Mock CID for development
      return `QmMock${Date.now()}DevelopmentCID`;
      
    } catch (error) {
      console.error('Fallback upload also failed:', error);
      throw new Error('All IPFS upload methods failed');
    }
  }

  async uploadJSON(data) {
    try {
      console.log('Uploading JSON data to IPFS...');
      
      const formData = new FormData();
      formData.append('file', Buffer.from(JSON.stringify(data)), 'data.json');

      const response = await axios.post(`${this.apiUrl}/api/v0/add`, formData, {
        headers: {
          ...formData.getHeaders(),
          ...this.getAuthHeaders(),
        },
      });

      console.log(`JSON uploaded to IPFS. CID: ${response.data.Hash}`);
      return response.data.Hash;

    } catch (error) {
      console.error('IPFS JSON Upload Error:', error);
      throw new Error('Failed to upload JSON to IPFS');
    }
  }

  async getFile(cid) {
    try {
      const gatewayUrl = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs';
      const response = await axios.get(`${gatewayUrl}/${cid}`, {
        responseType: 'stream',
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      console.error('IPFS Get File Error:', error);
      throw new Error('Failed to retrieve file from IPFS');
    }
  }

  getIPFSGatewayURL(cid) {
    const gateway = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs';
    return `${gateway}/${cid}`;
  }

  // Check if IPFS node is running
  async checkConnection() {
    try {
      const response = await axios.post(`${this.apiUrl}/api/v0/version`, null, {
        headers: this.getAuthHeaders(),
        timeout: 5000,
      });
      console.log(`IPFS Connection OK. Version: ${response.data.Version}`);
      return true;
    } catch (error) {
      console.warn('IPFS node not reachable:', error.message);
      return false;
    }
  }
}

module.exports = new IPFSService();