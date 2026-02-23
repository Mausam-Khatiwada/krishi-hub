const PDFDocument = require('pdfkit');

const generateInvoiceBuffer = async (order) =>
  new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(24).text('Krishihub Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Order ID: ${order._id}`);
    doc.text(`Buyer: ${order.buyer?.name || 'N/A'}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.moveDown();

    doc.fontSize(14).text('Items');
    doc.moveDown(0.3);

    order.items.forEach((item) => {
      doc
        .fontSize(11)
        .text(
          `${item.productName} | Qty: ${item.quantity} | Unit: NPR ${item.unitPrice} | Subtotal: NPR ${item.subtotal}`,
        );
    });

    doc.moveDown();
    doc.fontSize(12).text(`Discount: NPR ${order.discountAmount || 0}`);
    doc.fontSize(14).text(`Total: NPR ${order.totalAmount}`, { align: 'right' });

    doc.end();
  });

module.exports = {
  generateInvoiceBuffer,
};
