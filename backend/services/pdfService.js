const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PDFService {
  /**
   * Generate a municipal credential PDF certificate
   * @param {Object} credentialData - Credential blockchain & IPFS info
   * @param {Object} applicationData - Application info submitted by the user
   * @returns {string} Path to generated PDF
   */
  async generateCertificate(credentialData, applicationData) {
    try {
      // 1. Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // 2. Title
      page.drawText('MUNICIPAL CREDENTIAL CERTIFICATE', {
        x: 50,
        y: height - 50,
        size: 20,
        font: boldFont,
        color: rgb(0, 0.2, 0.4),
      });

      // 3. Credential Details
      let yPosition = height - 100;
      const details = [
        { label: 'Credential ID', value: credentialData.credentialId },
        { label: 'Type', value: credentialData.type },
        { label: 'Recipient', value: applicationData?.applicant?.name || '' },
        { label: 'Issue Date', value: new Date().toLocaleDateString('en-GB') },
        { label: 'IPFS CID', value: credentialData.ipfsCID || '' },
        { label: 'Transaction Hash', value: credentialData.blockchainTxHash || '' },
      ];

      details.forEach(d => {
        page.drawText(`${d.label}:`, { x: 50, y: yPosition, size: 12, font: boldFont, color: rgb(0, 0, 0) });
        page.drawText(d.value, { x: 200, y: yPosition, size: 12, font, color: rgb(0, 0, 0) });
        yPosition -= 20;
      });

      // 4. Application-specific Details
      yPosition -= 20;
      page.drawText('Application Details:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0.2, 0.4),
      });
      yPosition -= 25;

      switch (applicationData.type) {
        case 'BIRTH':
          this.drawBirthDetails(page, applicationData.birthDetails, font, yPosition);
          yPosition -= 100;
          break;

        case 'DEATH':
          this.drawDeathDetails(page, applicationData.deathDetails, font, yPosition);
          yPosition -= 100;
          break;

        case 'TRADE_LICENSE':
          this.drawTradeLicenseDetails(page, applicationData.tradeLicenseDetails, font, yPosition);
          yPosition -= 100;
          break;

        case 'NOC':
          this.drawNOCDetails(page, applicationData.nocDetails, font, yPosition);
          yPosition -= 100;
          break;

        default:
          page.drawText('No application details available', { x: 50, y: yPosition, size: 12, font, color: rgb(0.5, 0.5, 0.5) });
      }

      // 5. Generate QR Code
      const qrData = JSON.stringify({
        credentialId: credentialData.credentialId,
        ipfsCID: credentialData.ipfsCID,
        txHash: credentialData.blockchainTxHash,
        verifyUrl: `${process.env.FRONTEND_URL}/verify`,
      });

      const qrBuffer = await QRCode.toBuffer(qrData);
      const qrImage = await pdfDoc.embedPng(qrBuffer);
      page.drawImage(qrImage, { x: width - 150, y: 50, width: 100, height: 100 });

      // 6. Save PDF to temp folder
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const filePath = path.join(tempDir, `certificate-${crypto.randomUUID()}.pdf`);
      fs.writeFileSync(filePath, await pdfDoc.save());

      return filePath;
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw new Error('Failed to generate PDF certificate');
    }
  }

  // ------------------- Helper Methods ------------------- //

  drawBirthDetails(page, bd = {}, font, yStart) {
    const birthDetails = [
      { label: 'Child Name', value: bd.childName || '' },
      { label: 'Date of Birth', value: bd.dateOfBirth ? new Date(bd.dateOfBirth).toLocaleDateString('en-GB') : '' },
      { label: 'Place of Birth', value: bd.placeOfBirth || '' },
      { label: "Father's Name", value: bd.fatherName || '' },
      { label: "Mother's Name", value: bd.motherName || '' },
    ];
    let y = yStart;
    birthDetails.forEach(d => {
      page.drawText(`${d.label}: ${d.value}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
      y -= 15;
    });
  }

  drawDeathDetails(page, dd = {}, font, yStart) {
    const deathDetails = [
      { label: 'Deceased Name', value: dd.deceasedName || '' },
      { label: 'Date of Death', value: dd.dateOfDeath ? new Date(dd.dateOfDeath).toLocaleDateString('en-GB') : '' },
      { label: 'Place of Death', value: dd.placeOfDeath || '' },
      { label: 'Cause of Death', value: dd.causeOfDeath || '' },
      { label: 'Father/Mother Name', value: dd.parentName || '' },
    ];
    let y = yStart;
    deathDetails.forEach(d => {
      page.drawText(`${d.label}: ${d.value}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
      y -= 15;
    });
  }

  drawTradeLicenseDetails(page, td = {}, font, yStart) {
    const tradeDetails = [
      { label: 'Business Name', value: td.businessName || '' },
      { label: 'License Number', value: td.licenseNumber || '' },
      { label: 'Owner Name', value: td.ownerName || '' },
      { label: 'Business Address', value: td.businessAddress || '' },
      { label: 'Valid Till', value: td.validTill ? new Date(td.validTill).toLocaleDateString('en-GB') : '' },
    ];
    let y = yStart;
    tradeDetails.forEach(d => {
      page.drawText(`${d.label}: ${d.value}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
      y -= 15;
    });
  }

  drawNOCDetails(page, nd = {}, font, yStart) {
    const nocDetails = [
      { label: 'Applicant Name', value: nd.applicantName || '' },
      { label: 'NOC Purpose', value: nd.purpose || '' },
      { label: 'Issuing Authority', value: nd.authority || '' },
      { label: 'Valid From', value: nd.validFrom ? new Date(nd.validFrom).toLocaleDateString('en-GB') : '' },
      { label: 'Valid Till', value: nd.validTill ? new Date(nd.validTill).toLocaleDateString('en-GB') : '' },
    ];
    let y = yStart;
    nocDetails.forEach(d => {
      page.drawText(`${d.label}: ${d.value}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
      y -= 15;
    });
  }
}

module.exports = new PDFService();