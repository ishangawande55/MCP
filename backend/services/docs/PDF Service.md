# PDF Service Documentation

## 📋 Overview

The PDFService generates professional municipal credential certificates with embedded QR codes for verification. It creates standardized PDF documents for various credential types (Birth/Death certificates, Trade Licenses, NOCs) with blockchain and IPFS integration.

## 🏗️ Service Architecture

![PDF Service Architecture](diagrams/PDF%20Architecture.png)

## 🎯 Key Features

- **📄 Professional Templates**: Standardized layouts for different credential types
- **🔗 Blockchain Integration**: Displays transaction hashes and IPFS CIDs
- **📱 QR Verification**: Embedded QR codes for instant verification
- **🎨 Dynamic Content**: Adapts to different application types (Birth, Death, Trade, NOC)
- **📁 File Management**: Automatic temp directory management with unique filenames
- **⚡ Performance**: Efficient PDF generation with streaming capabilities

## 📝 Core Method

### PDF Generation Flow

![PDF Generation Flow](diagrams/PDF%20Generation.png)

**Method**: `generateCertificate(credentialData, applicationData)`
```javascript
/**
 * Generate a municipal credential PDF certificate
 * @param {Object} credentialData - Credential blockchain & IPFS info
 * @param {Object} applicationData - Application info submitted by the user
 * @returns {string} Path to generated PDF
 */
async generateCertificate(credentialData, applicationData) {
  try {
    // 1. Create PDF document with standard size
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]); // Width: 600, Height: 400 points
    const { width, height } = page.getSize();
    
    // 2. Embed fonts for professional typography
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 3. Document structure creation
    await this.createDocumentStructure(pdfDoc, page, font, boldFont, credentialData, applicationData);
    
    // 4. Save to filesystem
    return await this.savePDF(pdfDoc);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw new Error('Failed to generate PDF certificate');
  }
}
```

## 🎨 Document Structure

### Layout Overview

![Layout Overview](diagrams/Layout%20Overview.png)

### Content Sections

#### 1. Header Section
```javascript
// Title with official styling
page.drawText('MUNICIPAL CREDENTIAL CERTIFICATE', {
  x: 50,
  y: height - 50,    // Top positioning
  size: 20,
  font: boldFont,
  color: rgb(0, 0.2, 0.4), // Official blue color
});
```

#### 2. Credential Details Section
```javascript
const details = [
  { label: 'Credential ID', value: credentialData.credentialId },
  { label: 'Type', value: credentialData.type },
  { label: 'Recipient', value: applicationData?.applicant?.name || '' },
  { label: 'Issue Date', value: new Date().toLocaleDateString('en-GB') },
  { label: 'IPFS CID', value: credentialData.ipfsCID || '' },
  { label: 'Transaction Hash', value: credentialData.blockchainTxHash || '' },
];

// Render each detail line
details.forEach(d => {
  page.drawText(`${d.label}:`, { 
    x: 50, y: yPosition, size: 12, font: boldFont 
  });
  page.drawText(d.value, { 
    x: 200, y: yPosition, size: 12, font 
  });
  yPosition -= 20;
});
```

#### 3. Application-Specific Sections

##### Birth Certificate Details
```javascript
drawBirthDetails(page, bd = {}, font, yStart) {
  const birthDetails = [
    { label: 'Child Name', value: bd.childName || '' },
    { label: 'Date of Birth', value: bd.dateOfBirth ? new Date(bd.dateOfBirth).toLocaleDateString('en-GB') : '' },
    { label: 'Place of Birth', value: bd.placeOfBirth || '' },
    { label: "Father's Name", value: bd.fatherName || '' },
    { label: "Mother's Name", value: bd.motherName || '' },
  ];
  // Render each line
  let y = yStart;
  birthDetails.forEach(d => {
    page.drawText(`${d.label}: ${d.value}`, { 
      x: 50, y, size: 10, font, color: rgb(0, 0, 0) 
    });
    y -= 15;
  });
}
```

##### Trade License Details
```javascript
drawTradeLicenseDetails(page, td = {}, font, yStart) {
  const tradeDetails = [
    { label: 'Business Name', value: td.businessName || '' },
    { label: 'License Number', value: td.licenseNumber || '' },
    { label: 'Owner Name', value: td.ownerName || '' },
    { label: 'Business Address', value: td.businessAddress || '' },
    { label: 'Valid Till', value: td.validTill ? new Date(td.validTill).toLocaleDateString('en-GB') : '' },
  ];
  // Similar rendering logic...
}
```

## 📱 QR Code Integration

### QR Data Structure
```javascript
const qrData = JSON.stringify({
  credentialId: credentialData.credentialId,
  ipfsCID: credentialData.ipfsCID,
  txHash: credentialData.blockchainTxHash,
  verifyUrl: `${process.env.FRONTEND_URL}/verify`,
});
```

### QR Code Generation
```javascript
// Generate QR code as buffer
const qrBuffer = await QRCode.toBuffer(qrData);

// Embed QR code in PDF
const qrImage = await pdfDoc.embedPng(qrBuffer);
page.drawImage(qrImage, { 
  x: width - 150,  // Right-aligned
  y: 50,           // Bottom-aligned  
  width: 100, 
  height: 100 
});
```

## 💾 File Management

### Temporary Directory Handling
```javascript
async savePDF(pdfDoc) {
  const tempDir = path.join(__dirname, '../../temp');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Generate unique filename
  const filePath = path.join(tempDir, `certificate-${crypto.randomUUID()}.pdf`);
  
  // Save PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);
  
  return filePath;
}
```

## 💡 Usage Examples

### Complete Credential Issuance Flow
```javascript
const PDFService = require('./pdf-service');
const IPFSService = require('./ipfs-service');
const BlockchainService = require('./blockchain-service');

async function issueMunicipalCredential(applicationData, commissioner) {
  try {
    // 1. Generate credential data
    const credentialData = {
      credentialId: `vc:municipal:${crypto.randomBytes(8).toString('hex')}`,
      type: applicationData.type,
      issuerDID: commissioner.did,
      timestamp: new Date().toISOString()
    };

    // 2. Generate PDF certificate
    const pdfPath = await PDFService.generateCertificate(credentialData, applicationData);
    console.log('PDF generated at:', pdfPath);

    // 3. Upload PDF to IPFS
    const ipfsResult = await IPFSService.uploadFile(pdfPath);
    credentialData.ipfsCID = ipfsResult.cid;

    // 4. Calculate document hash for blockchain
    const pdfBuffer = fs.readFileSync(pdfPath);
    const documentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // 5. Anchor on blockchain
    const blockchainResult = await BlockchainService.issueCredential(
      credentialData.credentialId,
      documentHash,
      credentialData.ipfsCID
    );
    credentialData.blockchainTxHash = blockchainResult.transactionHash;

    // 6. Return complete credential package
    return {
      credentialData,
      pdfPath,
      ipfsUrl: IPFSService.getIPFSGatewayURL(credentialData.ipfsCID),
      blockchainExplorerUrl: `https://etherscan.io/tx/${credentialData.blockchainTxHash}`
    };

  } catch (error) {
    console.error('Credential issuance failed:', error);
    throw error;
  }
}
```

### Specific Certificate Types

#### Birth Certificate
```javascript
const birthApplication = {
  type: 'BIRTH',
  applicant: { name: 'Rajesh Kumar' },
  birthDetails: {
    childName: 'Priya Sharma',
    dateOfBirth: '2024-01-15',
    placeOfBirth: 'Municipal Hospital, Delhi',
    fatherName: 'Rajesh Kumar',
    motherName: 'Sunita Kumar'
  }
};

const birthCertificate = await PDFService.generateCertificate(credentialData, birthApplication);
```

#### Trade License
```javascript
const tradeApplication = {
  type: 'TRADE_LICENSE', 
  applicant: { name: 'Amit Patel' },
  tradeLicenseDetails: {
    businessName: 'Patel Electronics',
    licenseNumber: 'TL-2024-789',
    ownerName: 'Amit Patel',
    businessAddress: '123 Market Street, Mumbai',
    validTill: '2025-12-31'
  }
};

const tradeLicense = await PDFService.generateCertificate(credentialData, tradeApplication);
```

## 🛡️ Error Handling & Validation

### Comprehensive Error Management
```javascript
async function generateCertificate(credentialData, applicationData) {
  try {
    // Validate input data
    this.validateInput(credentialData, applicationData);
    
    // Generate PDF
    const pdfPath = await this.generatePDF(credentialData, applicationData);
    
    // Verify PDF was created
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file was not created successfully');
    }
    
    return pdfPath;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    
    // Cleanup any partially created files
    await this.cleanupFailedGeneration();
    
    throw new Error(`Failed to generate PDF certificate: ${error.message}`);
  }
}

validateInput(credentialData, applicationData) {
  if (!credentialData?.credentialId) {
    throw new Error('Credential ID is required');
  }
  
  if (!applicationData?.type) {
    throw new Error('Application type is required');
  }
  
  const validTypes = ['BIRTH', 'DEATH', 'TRADE_LICENSE', 'NOC'];
  if (!validTypes.includes(applicationData.type)) {
    throw new Error(`Invalid application type: ${applicationData.type}`);
  }
}
```

## 📊 Performance Optimization

### Memory Management
```javascript
// For high-volume generation, consider streaming
async generateCertificateStream(credentialData, applicationData) {
  const pdfDoc = await PDFDocument.create();
  
  // ... build document
  
  // Return stream instead of file path
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// Usage in API response
app.get('/certificate/:id', async (req, res) => {
  const pdfBuffer = await PDFService.generateCertificateStream(credentialData, appData);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=certificate.pdf');
  res.send(pdfBuffer);
});
```

### Template Caching
```javascript
class OptimizedPDFService extends PDFService {
  constructor() {
    super();
    this.fontCache = new Map();
  }
  
  async getFont(pdfDoc, fontName) {
    if (!this.fontCache.has(fontName)) {
      const font = await pdfDoc.embedFont(StandardFonts[fontName]);
      this.fontCache.set(fontName, font);
    }
    return this.fontCache.get(fontName);
  }
}
```

## 🔧 Customization Options

### Branding Configuration
```javascript
const BRAND_CONFIG = {
  primaryColor: { r: 0, g: 0.2, b: 0.4 },
  secondaryColor: { r: 0.8, g: 0.1, b: 0.1 },
  logoPath: '/assets/municipal-logo.png',
  headerText: 'MUNICIPAL CORPORATION CERTIFICATE',
  watermark: 'OFFICIAL DOCUMENT'
};

// Customize with branding
page.drawText(BRAND_CONFIG.headerText, {
  x: 50, y: height - 50,
  size: 20,
  font: boldFont, 
  color: rgb(...Object.values(BRAND_CONFIG.primaryColor)),
});
```

### Multi-Language Support
```javascript
const LOCALIZED_STRINGS = {
  en: {
    title: 'MUNICIPAL CREDENTIAL CERTIFICATE',
    credentialId: 'Credential ID',
    recipient: 'Recipient',
    // ... other strings
  },
  hi: {
    title: 'नगर निगम प्रमाणपत्र',
    credentialId: 'क्रेडेंशियल आईडी',
    recipient: 'प्राप्तकर्ता',
    // ... Hindi translations
  }
};

function getLocalizedStrings(language = 'en') {
  return LOCALIZED_STRINGS[language] || LOCALIZED_STRINGS.en;
}
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Dependencies**: pdf-lib, qrcode, crypto, fs, path  
**PDF Standards**: PDF 1.7 compatible  
**Browser Support**: All modern browsers with PDF support  
**License**: MIT